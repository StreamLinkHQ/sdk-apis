// import express, { Request, Response } from "express";
// import { createServer } from "http";
// import { PrismaClient } from "@prisma/client";
// import cors from "cors";
// import {
//   AgendaRouter,
//   LiveStreamRouter,
//   PaymentRouter,
//   UserRouter,
//   ParticipantRouter,
// } from "./routes/index.js";
// import createSocketServer from "./websocket.js";
// const app = express();
// const port = 8001;
// const httpServer = createServer(app);
// export const db = new PrismaClient();
// app.use(express.json());
// const corsOptions = {
//   origin: ["http://localhost:5173", "http://localhost:5174"],
// };
// createSocketServer(httpServer);
// app.use(cors(corsOptions));
// app.use("/pay", PaymentRouter.default);
// app.use("/livestream", LiveStreamRouter.default);
// app.use("/agenda", AgendaRouter.default);
// app.use("/participant", ParticipantRouter.default);
// app.use("/user", UserRouter.default);
// app.all("*", (req: Request, res: Response) => {
//   res.status(404).json({ error: `Route ${req.originalUrl} not found` });
// });
// httpServer.listen(port, () => {
//   console.log(`Server is listening on port ${port}`);
// });
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
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Add body logging middleware for debugging
app.use((req, res, next) => {
    // console.log('Request Body:', req.body);
    // console.log('Content-Type:', req.headers['content-type']);
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
