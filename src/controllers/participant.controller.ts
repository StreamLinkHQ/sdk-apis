import { Request, Response } from "express";
import { db } from "../app.js";

export const getLiveStreamParticipants = async (
  req: Request,
  res: Response
) => {
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
      return res.status(400).json({
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

export const updateLiveStreamParticipant = async (
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
      return res.status(400).json({
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
    if (participant.userType === 'host') {
      // Check if there are any other active hosts
      const otherActiveHosts = liveStream.participants.some(
        p => p.userType === 'host' && 
            p.id !== participant.id && 
            !p.leftAt
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