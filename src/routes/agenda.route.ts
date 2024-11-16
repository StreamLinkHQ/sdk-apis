import express from "express";
import {
  createAgenda,
  getLiveStreamAgenda,
  updateLiveStreamAgenda,
  deleteAgenda,
} from "../controllers/agenda.controller.js";

const router = express.Router();

router.post("/:liveStreamId", createAgenda);
router.get("/:liveStreamId", getLiveStreamAgenda);
router.put("/:agendaId", updateLiveStreamAgenda);
router.delete("/:agendaId", deleteAgenda);

export default router;
