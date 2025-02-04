import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, } from "@solana/spl-token";
import { tokenMintAccounts, connection } from "../utils/index.js";
import { db } from "../prisma.js";
export const createTransaction = async (req, res) => {
    const { senderPublicKey, recipients, tokenName } = req.body;
    const companyPublicKey = "4jhQjEw1CtMkyE9PXNVMBmUNEBekpiF4XudwDjWFZsnc";
    const feeInLamports = 0.06 * LAMPORTS_PER_SOL; // $0.06 in lamports
    try {
        // Validate input
        if (!senderPublicKey ||
            !recipients ||
            !Array.isArray(recipients) ||
            recipients.length === 0 ||
            !tokenName) {
            return res.status(400).json({
                error: "Missing required fields: senderPublicKey, recipients array, and tokenName",
            });
        }
        let sender = new PublicKey(senderPublicKey);
        const transaction = new Transaction();
        // Process each recipient
        for (const recipient of recipients) {
            const { recipientPublicKey, amount } = recipient;
            if (!recipientPublicKey || isNaN(amount) || amount <= 0) {
                return res.status(400).json({
                    error: "Each recipient must have a valid public key and a positive amount.",
                });
            }
            let recipientKey;
            try {
                recipientKey = new PublicKey(recipientPublicKey);
            }
            catch (error) {
                return res
                    .status(400)
                    .json({ error: "Invalid recipient public key format." });
            }
            if (tokenName.toLowerCase() === "sol") {
                // Handle SOL Transfer
                transaction.add(SystemProgram.transfer({
                    fromPubkey: sender,
                    toPubkey: recipientKey,
                    lamports: amount * 1e9, // amount in lamports (1 SOL = 10^9 lamports)
                }));
            }
            else {
                const mintAddress = tokenMintAccounts[tokenName.toLowerCase()];
                if (!mintAddress) {
                    return res.status(400).json({ error: "Token not supported." });
                }
                const mint = new PublicKey(mintAddress);
                const senderTokenAccount = await getAssociatedTokenAddress(mint, sender);
                const recipientTokenAccount = await getAssociatedTokenAddress(mint, recipientKey);
                const recipientTokenAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
                if (!recipientTokenAccountInfo) {
                    transaction.add(createAssociatedTokenAccountInstruction(sender, recipientTokenAccount, recipientKey, mint));
                }
                transaction.add(createTransferInstruction(senderTokenAccount, recipientTokenAccount, sender, amount, [], TOKEN_PROGRAM_ID));
            }
        }
        // Add fee to company's public key
        const companyKey = new PublicKey(companyPublicKey);
        transaction.add(SystemProgram.transfer({
            fromPubkey: sender,
            toPubkey: companyKey,
            lamports: feeInLamports,
        }));
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = sender;
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
        });
        res
            .status(200)
            .json({ transaction: serializedTransaction.toString("base64") });
    }
    catch (error) {
        console.error("Error creating transaction:", error);
        res.status(500).json({ error: "Failed to create transaction" });
    }
};
export const submitTransaction = async (req, res) => {
    const { signedTransaction, wallet } = req.body;
    try {
        const transactionBuffer = Buffer.from(signedTransaction, "base64");
        const transaction = Transaction.from(transactionBuffer);
        const signature = await connection.sendRawTransaction(transaction.serialize());
        await connection.confirmTransaction(signature, "confirmed");
        let user = await db.user.findUnique({
            where: {
                walletAddress: wallet,
            },
        });
        if (!user) {
            user = await db.user.create({
                data: {
                    walletAddress: wallet,
                    points: 5,
                },
            });
        }
        else {
            user = await db.user.update({
                where: {
                    walletAddress: wallet,
                },
                data: {
                    points: (user.points || 0) + 5,
                },
            });
        }
        const response = await db.transaction.create({
            data: {
                signature,
                createdAt: new Date(),
                user: {
                    connect: {
                        id: user.id,
                    },
                },
            },
        });
        res.json({ data: "Payment successful", signature: response.signature });
    }
    catch (error) {
        console.error("Error submitting transaction:", error);
        res.status(500).json({ error: "Failed to submit transaction" });
    }
    finally {
        await db.$disconnect();
    }
};
