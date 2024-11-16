import express from "express";
import { createTransaction, submitTransaction } from "../controllers/payment.controller.js";
const router = express.Router();
router.post("/", createTransaction);
router.post("/submit", submitTransaction);
// router.post("/nft", createNftTransaction)
// router.post("/submit-nft", sendSignedTransaction)
export default router;
