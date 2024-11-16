import express from "express";
import { createUser, getUser, updateUser } from "../controllers/user.controller.js";

const router = express.Router();

router.post("/", createUser);
router.get("/:userWallet", getUser);
router.put("/:userId", updateUser)

export default router;
