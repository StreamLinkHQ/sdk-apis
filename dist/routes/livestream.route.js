import express from "express";
import { createLiveStream, createStreamToken, getLiveStream, updateGuestPermissions } from "../controllers/livestream.controller.js";
const router = express.Router();
router.post("/", createLiveStream);
router.post("/token", createStreamToken);
router.get("/:liveStreamId", getLiveStream);
router.post("/invite", updateGuestPermissions);
export default router;