import { Request, Response } from "express";
import {
  AccessToken,
  EgressClient,
  EncodedFileOutput,
  StreamOutput,
  StreamProtocol,
} from "livekit-server-sdk";
import { AgendaAction } from "@prisma/client";
import { db } from "../app.js";
import { generateMeetingLink, isValidWalletAddress, roomService, livekitHost  } from "../utils/index.js";

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
    if (
      !roomName ||
      !userName ||
      !userType ||
      !wallet ||
      typeof wallet !== "string"
    ) {
      return res.status(400).json({
        error:
          "Missing required fields: room name, wallet, user type, and user name",
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
    if (userType === "guest" && !existingStream.hasHost) {
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
            // userName: userName,
            userType,
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
    if (userType === "host") {
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
        metadata: JSON.stringify({
          userName,
          participantId: existingParticipant?.id,
          userType,
        }),
      }
    );

    accessToken.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: userType === "host" ? true : false,
      canSubscribe: true,
      canPublishData: true,
      roomRecord: userType === "host" ? true : false,
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

export const recordLiveStream = async (req: Request, res: Response) => {
  const { roomName, userType, wallet } = req.body;

  try {
    if (!roomName || !userType || !wallet || typeof wallet !== "string") {
      return res.status(400).json({
        error:
          "Missing required fields: room name, wallet, user type, and user name",
      });
    }
    if (!isValidWalletAddress(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address format." });
    }
    const egressService = new EgressClient(
      livekitHost,
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET
    );

    const output = {
      file: new EncodedFileOutput({
        filepath: "my-test-file.mp4",
        output: {
          case: "aliOSS",
          value: {
            accessKey: process.env.ALIOSS_ACCESSKEY_ID,
            secret: process.env.ALIOSS_ACCESSKEY_SECRET,
            bucket: process.env.ALIOSS_BUCKET,
            endpoint: process.env.ALIOSS_ENDPOINT,
            region: process.env.ALIOSS_REGION,
          },
        },
      }),
      stream: new StreamOutput({
        protocol: StreamProtocol.RTMP,
        urls: [],
      }),
    };
    const testing = await egressService.startRoomCompositeEgress(
      roomName,
      output
    );
    console.log({ testing });
    res.status(201).json(`Recording started successfully`);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
};

export const stopLiveStreamRecord = async (req: Request, res: Response) => {
  try {
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
};
