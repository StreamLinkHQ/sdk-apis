import { Connection } from "@solana/web3.js";
// export const connection = new Connection('https://devnet.helius-rpc.com/?api-key=460424af-54bf-4327-a17e-84620d95352b', 'confirmed');
// export const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
export const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=460424af-54bf-4327-a17e-84620d95352b', 'confirmed');
export const tokenMintAccounts = {
    usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    abj: "ArPqn2d4q1BepXfQmWLbELMBMtQjyUiFMcTvQjDFT22i",
};
// export const createStreamToken = async (req: Request, res: Response) => {
//   const { roomName, userType, userName, wallet } = req.body;
//   try {
//     // Validate inputs
//     if (!roomName || !userName || !userType || !wallet || typeof wallet !== "string") {
//       return res.status(400).json({
//         error: "Missing required fields: room name, wallet, user type, and user name",
//       });
//     }
//     if (!isValidWalletAddress(wallet)) {
//       return res.status(400).json({ error: "Invalid wallet address format." });
//     }
//     // Find the stream
//     const existingStream = await db.liveStream.findUnique({
//       where: { name: roomName },
//     });
//     if (!existingStream) {
//       return res.status(400).json({
//         error: "Room name does not exist",
//       });
//     }
//     // Check if guest can join
//     if (userType === 'guest' && !existingStream.hasHost) {
//       return res.status(403).json({
//         error: "Cannot join: Waiting for host to join the room",
//       });
//     }
//     // Handle participant
//     let participant = await db.participant.findFirst({
//       where: {
//         walletAddress: wallet,
//         liveStreamId: existingStream.id,
//       },
//     });
//     // Create or update participant BEFORE generating token
//     if (participant) {
//       if (participant.leftAt) {
//         participant = await db.participant.update({
//           where: { id: participant.id },
//           data: { 
//             leftAt: null, 
//             userName: userName, // Update username
//             userType
//           },
//         });
//       }
//     } else {
//       participant = await db.participant.create({
//         data: {
//           userName,
//           walletAddress: wallet,
//           userType,
//           liveStreamId: existingStream.id,
//         },
//       });
//     }
//     // Update hasHost if this is a host joining
//     if (userType === 'host') {
//       await db.liveStream.update({
//         where: { id: existingStream.id },
//         data: { hasHost: true },
//       });
//     }
//     // Generate token with participant info
//     const accessToken = new AccessToken(
//       process.env.LIVEKIT_API_KEY,
//       process.env.LIVEKIT_API_SECRET,
//       {
//         identity: participant.id, // Now we have a valid participant ID
//         ttl: "60m",
//         metadata: JSON.stringify({
//           userName,
//           participantId: participant.id,
//           userType
//         })
//       }
//     );
//     accessToken.addGrant({
//       roomJoin: true,
//       room: roomName,
//       canPublish: userType === "host" ? true : false,
//       canSubscribe: true,
//       canPublishData: true,
//     });
//     const token = await accessToken.toJwt();
//     res.status(200).json(token);
//     const participants = await roomService.listParticipants(roomName);
//     console.log("LiveKit Participants:", participants);
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ error });
//   }
// };
