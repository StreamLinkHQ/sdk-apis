import { db } from "../prisma.js";
export const createPollResponse = async (req, res) => {
    const { agendaId, response, respondent } = req.body;
    console.log(req.body);
    try {
        if (!agendaId || !response || !respondent) {
            return res.status(400).json({
                error: "Missing required fields",
            });
        }
        const pollDetails = await db.agendaDetails.findUnique({
            where: { agendaId },
            include: { pollVotes: true },
        });
        if (!pollDetails) {
            return res.status(404).json({ error: "Poll not found" });
        }
        if (!pollDetails.wallets.includes(response)) {
            return res.status(400).json({ error: "Invalid option selected" });
        }
        const user = await db.user.findUnique({
            where: {
                walletAddress: respondent,
            },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        // Check if user has already voted
        const existingVote = await db.pollVote.findFirst({
            where: {
                agendaDetailsId: pollDetails.id,
                voterId: user.id,
            },
        });
        if (existingVote) {
            return res.status(400).json({ error: "User has already voted" });
        }
        // Create the vote
        const vote = await db.pollVote.create({
            data: {
                agendaDetails: { connect: { id: pollDetails.id } },
                selectedOption: response,
                voter: { connect: { id: user.id } },
            },
        });
        // Update total votes
        await db.agendaDetails.update({
            where: { id: pollDetails.id },
            data: { totalVotes: { increment: 1 } },
        });
        return res
            .status(201)
            .json({ message: "Vote recorded successfully", vote });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ error: "Failed to submit vote" });
    }
    finally {
        await db.$disconnect();
    }
};
export const getPollResponses = async (req, res) => {
    const { agendaId } = req.params;
    try {
        if (!agendaId) {
            return res.status(400).json({
                error: "Missing required field",
            });
        }
        const pollDetails = await db.agendaDetails.findUnique({
            where: {
                agendaId,
            },
            include: {
                pollVotes: true,
            },
        });
        if (!pollDetails) {
            return res.status(404).json({ error: "Poll not found" });
        }
        const voteCounts = pollDetails.wallets.reduce((acc, option) => {
            acc[option] = pollDetails.pollVotes.filter((vote) => vote.selectedOption === option).length;
            return acc;
        }, {});
        return res.status(200).json({
            item: pollDetails.item,
            totalVotes: pollDetails.pollVotes.length,
            voteCounts,
        });
    }
    catch (error) {
        console.error("Failed to fetch poll results:", error);
        return res.status(500).json({ error: "Failed to fetch poll results" });
    }
    finally {
        await db.$disconnect();
    }
};
export const getUserVote = async (req, res) => {
    const { agendaId, walletAddress } = req.params;
    try {
        if (!agendaId || !walletAddress) {
            return res.status(400).json({
                error: "Missing required field",
            });
        }
        const pollDetails = await db.agendaDetails.findUnique({
            where: { agendaId },
        });
        if (!pollDetails) {
            return res.status(404).json({ error: "Poll not found" });
        }
        const user = await db.user.findUnique({
            where: {
                walletAddress,
            },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const userVote = await db.pollVote.findFirst({
            where: {
                agendaDetailsId: pollDetails.id,
                voterId: user.id,
            },
        });
        return res.status(200).json({ vote: userVote });
    }
    catch (error) {
        console.error("Failed to fetch user vote:", error);
        return res.status(500).json({ error: "Failed to fetch user vote" });
    }
    finally {
        await db.$disconnect();
    }
};
