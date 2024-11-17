import express from "express";
import { createServer } from "http";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import { AgendaRouter, LiveStreamRouter, PaymentRouter, UserRouter, ParticipantRouter, PollRouter } from "./routes/index.js";
import createSocketServer from "./websocket.js";
const app = express();
const port = 8001;
const httpServer = createServer(app);
export const db = new PrismaClient();
// Move cors before other middleware
const corsOptions = {
    origin: ["https://thestreamlink.com", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"],
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Add body logging middleware for debugging
app.use((req, res, next) => {
    next();
});
export const io = createSocketServer(httpServer);
app.use("/pay", PaymentRouter.default);
app.use("/livestream", LiveStreamRouter.default);
app.use("/agenda", AgendaRouter.default);
app.use("/participant", ParticipantRouter.default);
app.use("/poll", PollRouter.default);
app.use("/user", UserRouter.default);
app.all("*", (req, res) => {
    res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});
httpServer.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
