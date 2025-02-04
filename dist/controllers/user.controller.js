import { isValidWalletAddress } from "../utils/index.js";
import { db } from "../prisma.js";
export const createUser = async (req, res) => {
    try {
        const { wallet } = req.body;
        if (!wallet || typeof wallet !== "string") {
            return res.status(400).json({ error: "Wallet address is required." });
        }
        if (!isValidWalletAddress(wallet)) {
            return res.status(400).json({ error: "Invalid wallet address format." });
        }
        const user = await db.user.upsert({
            where: { walletAddress: wallet },
            update: {},
            create: { walletAddress: wallet },
        });
        res.status(201).json({ data: user });
    }
    catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ error: "An unexpected error occurred." });
    }
    finally {
        await db.$disconnect();
    }
};
export const getUser = async (req, res) => {
    const { userWallet } = req.params;
    try {
        if (!userWallet) {
            return res.status(400).json({
                error: "Missing required field",
            });
        }
        const user = await db.user.findUnique({
            where: {
                walletAddress: userWallet,
            },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(200).json(user);
    }
    catch (error) {
        console.error("Error getting user:", error);
        res.status(500).json({ error: "An unexpected error occurred." });
    }
    finally {
        await db.$disconnect();
    }
};
export const updateUser = async (req, res) => {
    const { userId } = req.params;
    const updates = req.body;
    try {
        if (!userId) {
            return res.status(400).json({
                error: "Missing required field",
            });
        }
        const user = await db.user.update({
            where: { id: userId },
            data: updates,
        });
        res.status(201).json({ data: user });
    }
    catch (error) {
        console.error("Error getting user:", error);
        res.status(500).json({ error: "An unexpected error occurred." });
    }
    finally {
        await db.$disconnect();
    }
};
