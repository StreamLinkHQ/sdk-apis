import { Request, Response } from "express";
import { db, io } from "../app.js";
import { guestRequests } from "../websocket.js";
import { roomService, isValidWalletAddress } from "../utils/index.js";

export const getStreamParticipants = async (req: Request, res: Response) => {
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
      include: { participants: true },
    });

    if (!liveStream) {
      return res.status(404).json({
        error: `LiveStream with name ${liveStreamId} not found`,
      });
    }

    const allParticipants = liveStream.participants;
    res.status(200).json({ participants: allParticipants });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
};

export const updateStreamParticipantTime = async (
  req: Request,
  res: Response
) => {
  const { liveStreamId } = req.params;
  const { walletAddress, leftAt } = req.body;

  try {
    // Input validation
    if (!liveStreamId || !walletAddress || !leftAt) {
      return res.status(400).json({
        error: "Missing required field",
      });
    }

    // Find the livestream
    const liveStream = await db.liveStream.findFirst({
      where: {
        name: liveStreamId,
      },
      include: {
        participants: true, // Include participants to check user type
      },
    });

    if (!liveStream) {
      return res.status(404).json({
        error: `LiveStream with name ${liveStreamId} not found`,
      });
    }

    // Find the leaving participant
    const participant = await db.participant.findFirst({
      where: {
        liveStreamId: liveStream.id,
        walletAddress,
      },
    });

    if (!participant) {
      return res.status(404).json({
        error: "Participant not found",
      });
    }

    // Update participant's leftAt timestamp
    await db.participant.update({
      where: {
        id: participant.id,
      },
      data: {
        leftAt: new Date(leftAt),
      },
    });

    // If the leaving participant is a host, update hasHost status
    if (participant.userType === "host") {
      // Check if there are any other active hosts
      const otherActiveHosts = liveStream.participants.some(
        (p) => p.userType === "host" && p.id !== participant.id && !p.leftAt
      );

      // Only set hasHost to false if this was the last active host
      if (!otherActiveHosts) {
        await db.liveStream.update({
          where: {
            id: liveStream.id,
          },
          data: {
            hasHost: false,
          },
        });
      }
    }

    return res
      .status(200)
      .json({ message: "Participant updated successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
};

export const updateGuestPermissions = async (req: Request, res: Response) => {
  const { participantId, roomName, walletAddress } = req.body;

  io.to(roomName).emit("inviteGuest", { participantId, roomName });

  try {
    if (!roomName || !participantId) {
      return res.status(400).json({
        error: "Missing required fields: room name and participantId",
      });
    }

    const liveStream = await db.liveStream.findFirst({
      where: {
        name: roomName,
      },
      include: {
        participants: true,
      },
    });

    if (!liveStream) {
      return res.status(404).json({
        error: `LiveStream with name ${roomName} not found`,
      });
    }

    if (guestRequests[roomName]) {
      guestRequests[roomName] = guestRequests[roomName].filter(
        (req) => req.participantId !== participantId
      );

      io.to(roomName).emit("guestRequestsUpdate", guestRequests[roomName]);
    }

    const participant = await db.participant.findFirst({
      where: {
        liveStreamId: liveStream.id,
        walletAddress,
      },
    });

    if (!participant) {
      return res.status(404).json({
        error: "Participant not found",
      });
    }
    await db.participant.update({
      where: {
        id: participant.id,
      },
      data: {
        userType: "temp-host",
      },
    });

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

export const updateTempHostPermissions = async (
  req: Request,
  res: Response
) => {
  const { participantId, roomName, walletAddress } = req.body;

  io.to(roomName).emit("returnToGuest", { participantId, roomName });
  try {
    if (
      !roomName ||
      !participantId ||
      !walletAddress ||
      typeof walletAddress !== "string"
    ) {
      return res.status(400).json({
        error:
          "Missing required fields: room name, wallet address and participantId",
      });
    }

    if (!isValidWalletAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address format." });
    }
    const liveStream = await db.liveStream.findFirst({
      where: {
        name: roomName,
      },
      include: {
        participants: true,
      },
    });

    if (!liveStream) {
      return res.status(404).json({
        error: `LiveStream with name ${roomName} not found`,
      });
    }

    if (guestRequests[roomName]) {
      guestRequests[roomName] = guestRequests[roomName].filter(
        (req) => req.participantId !== participantId
      );

      io.to(roomName).emit("guestRequestsUpdate", guestRequests[roomName]);
    }

    const participant = await db.participant.findFirst({
      where: {
        liveStreamId: liveStream.id,
        walletAddress,
      },
    });

    if (!participant) {
      return res.status(404).json({
        error: "Participant not found",
      });
    }

    await db.participant.update({
      where: {
        id: participant.id,
      },
      data: {
        userType: "guest",
      },
    });

    await roomService.updateParticipant(roomName, participantId, undefined, {
      canPublish: false,
      canSubscribe: true,
    });

    res
      .status(200)
      .json(`Revoked speaking permissions for participant ${participantId}.`);
  } catch (error) {
    console.error("Failed to update participant permissions:", error);
    res.status(500).json({ error });
  }
};
