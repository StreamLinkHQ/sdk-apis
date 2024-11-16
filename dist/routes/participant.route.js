import express from "express";
import { getLiveStreamParticipants, updateLiveStreamParticipant, } from "../controllers/participant.controller.js";
const router = express.Router();
router.get("/:liveStreamId", getLiveStreamParticipants);
router.put("/:liveStreamId", updateLiveStreamParticipant);
export default router;
