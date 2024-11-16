import express from "express";
import { createPollResponse, getPollResponses, getUserVote } from "../controllers/poll.controller.js";
const router = express.Router();
router.post("/", createPollResponse);
router.get("/:agendaId", getPollResponses);
router.get("/:agendaId/user-vote/:walletAddress", getUserVote);
export default router;
