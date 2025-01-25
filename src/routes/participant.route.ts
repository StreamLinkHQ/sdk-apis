import express from "express";
import {
  getStreamParticipants,
  updateStreamParticipantTime,
  updateGuestPermissions,
  updateTempHostPermissions
} from "../controllers/participant.controller.js";

const router = express.Router();
router.get("/:liveStreamId", getStreamParticipants);
router.put("/:liveStreamId", updateStreamParticipantTime);
router.post("/make-host", updateGuestPermissions);
router.post("/make-guest", updateTempHostPermissions);

export default router;
