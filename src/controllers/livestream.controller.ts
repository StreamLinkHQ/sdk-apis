import { Request, Response } from "express";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { AgendaAction } from "@prisma/client";
import { db, io } from "../app.js";
import { generateMeetingLink, isValidWalletAddress } from "../utils/index.js";
import { guestRequests } from "../websocket.js";

const livekitHost = process.env.LIVEKIT_API_HOST as string;
const roomService = new RoomServiceClient(
  livekitHost,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

async function generateUniqueStreamName(): Promise<string> {
  let isUnique = false;
  let streamName = "";

  while (!isUnique) {
    streamName = generateMeetingLink();

    const existingStream = await db.liveStream.findUnique({
      where: { name: streamName },
    });

    if (!existingStream) {
      isUnique = true;
    }
  }

  return streamName;
}

export const createLiveStream = async (req: Request, res: Response) => {
  const { wallet, agendas, callType, scheduledFor } = req.body;
  const liveStreamAgendas = [];

  try {
    if (
      !wallet ||
      typeof wallet !== "string" ||
      !callType ||
      !Array.isArray(agendas) ||
      agendas.length === 0
    ) {
      return res.status(400).json({
        error:
          "Missing required fields: streamName, agendas, call type and wallet address",
      });
    }

    if (!isValidWalletAddress(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address format." });
    }

    if (scheduledFor) {
      const now = new Date();
      const scheduledDate = new Date(scheduledFor);

      // Check if the provided date is in the past
      if (scheduledDate < now) {
        return res
          .status(400)
          .json({ error: "Cannot schedule a stream in the past." });
      }
    }
    // Generate a unique stream name
    const streamName = await generateUniqueStreamName();

    let user = await db.user.findUnique({
      where: {
        walletAddress: wallet,
      },
    });

    if (!user) {
      user = await db.user.create({
        data: {
          walletAddress: wallet,
        },
      });
    }
    const { name } = await roomService.createRoom({
      name: streamName,
      emptyTimeout: 300,
      maxParticipants: 100,
    });

    const liveStream = await db.liveStream.create({
      data: {
        name,
        callType,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        user: {
          connect: { id: user.id },
        },
      },
    });

    for (const agenda of agendas) {
      const actionEnum =
        AgendaAction[
          agenda.action.replace("&", "_") as keyof typeof AgendaAction
        ];

      if (!actionEnum) {
        return res
          .status(400)
          .json({ error: `Invalid agenda action: ${agenda.action}` });
      }
      const agendaRes = await db.agenda.create({
        data: {
          liveStreamId: liveStream.id,
          timeStamp: agenda.timeStamp,
          action: actionEnum,
          details: {
            create: {
              wallets: agenda.details.wallets,
              item: agenda.details.item,
            },
          },
        },
      });
      liveStreamAgendas.push(agendaRes);
    }
    const response = { ...liveStream, agendas: liveStreamAgendas };
    res.status(201).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
};

export const createStreamToken = async (req: Request, res: Response) => {
  const { roomName, userType, userName, wallet } = req.body;

  try {
    // Validate inputs
    if (!roomName || !userName || !userType || !wallet || typeof wallet !== "string") {
      return res.status(400).json({
        error: "Missing required fields: room name, wallet, user type, and user name",
      });
    }

    if (!isValidWalletAddress(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address format." });
    }

    // Find the stream
    const existingStream = await db.liveStream.findUnique({
      where: { name: roomName },
    });

    if (!existingStream) {
      return res.status(400).json({
        error: "Room name does not exist",
      });
    }

    // Check if guest can join
    if (userType === 'guest' && !existingStream.hasHost) {
      return res.status(403).json({
        error: "Cannot join: Waiting for host to join the room",
      });
    }

    // Handle participant
    const existingParticipant = await db.participant.findFirst({
      where: {
        walletAddress: wallet,
        liveStreamId: existingStream.id,
      },
    });

    if (existingParticipant) {
      if (existingParticipant.leftAt) {
        await db.participant.update({
          where: { id: existingParticipant.id },
          data: { 
            leftAt: null, 
            userName: userName 
          },
        });
      }
    } else {
      await db.participant.create({
        data: {
          userName,
          walletAddress: wallet,
          userType,
          liveStreamId: existingStream.id,
        },
      });
    }

      // Update hasHost if this is a host joining
      if (userType === 'host') {
        await db.liveStream.update({
          where: { id: existingStream.id },
          data: { hasHost: true },
        });
      }
    // Generate token
    const accessToken = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: userName,
        ttl: "60m",
      }
    );

    accessToken.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: userType === "host" ? true : false,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await accessToken.toJwt();
    res.status(200).json(token);

  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
};
export const getLiveStream = async (req: Request, res: Response) => {
  const { liveStreamId } = req.params;

  try {
    if (!liveStreamId) {
      return res.status(400).json({
        error: "Missing required field",
      });
    }

    const liveStream = await db.liveStream.findFirst({
      where: {
        name: liveStreamId,
      },
      include: {
        agenda: {
          include: {
            details: true,
          },
        },
      },
    });
    res.status(200).json(liveStream);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
};

export const updateGuestPermissions = async (req: Request, res: Response) => {
  const { participantId, roomName } = req.body;

  io.to(roomName).emit("inviteGuest", { participantId, roomName });

  try {
    if (!roomName || !participantId) {
      return res.status(400).json({
        error: "Missing required fields: room name and participantId",
      });
    }

    if (guestRequests[roomName]) {
      guestRequests[roomName] = guestRequests[roomName].filter(
        (req) => req.participantId !== participantId
      );

      io.to(roomName).emit("guestRequestsUpdate", guestRequests[roomName]);
    }

    await roomService.updateParticipant(roomName, participantId, undefined, {
      canPublish: true,
      canSubscribe: true,
    });

    res.status(200).json(`Invited participant ${participantId} to speak.`);
  } catch (error) {
    console.error("Failed to update participant permissions:", error);
    res.status(500).json({ error });
  }
};
