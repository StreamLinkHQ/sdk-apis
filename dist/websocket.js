import { Server } from "socket.io";
const roomStates = {};
export const guestRequests = {};
const createSocketServer = (server) => {
    const io = new Server(server, {
        cors: {
            origin: ["https://thestreamlink.com", "http://localhost:5173", "https://streamlink-sdk.netlify.app/"],
        },
    });
    const activeAddons = {
        Custom: { type: "Custom", isActive: false },
        "Q&A": { type: "Q&A", isActive: false },
        Poll: { type: "Poll", isActive: false },
    };
    // Initialize room timer
    const startRoomTimer = (roomName) => {
        const interval = setInterval(() => {
            if (roomStates[roomName]) {
                roomStates[roomName].currentTime += 1;
                io.to(roomName).emit("timeSync", roomStates[roomName].currentTime);
            }
            else {
                clearInterval(interval);
            }
        }, 1000);
    };
    io.on("connection", (socket) => {
        // console.log("A user connected", socket.id);
        let currentRoom = null;
        let currentIdentity = null;
        socket.emit("addonState", activeAddons);
        // Handle starting addons
        socket.on("startAddon", (data) => {
            console.log(`Starting ${data.type} addon`);
            activeAddons[data.type] = {
                type: data.type,
                isActive: true,
                data: data.data,
            };
            io.emit("addonStateUpdate", activeAddons[data.type]);
        });
        // Handle stopping addons
        socket.on("stopAddon", (type) => {
            console.log(`Stopping ${type} addon`);
            activeAddons[type] = {
                type: type,
                isActive: false,
                data: null,
            };
            io.emit("addonStateUpdate", activeAddons[type]);
        });
        socket.on("joinRoom", (roomName, participantId) => {
            socket.join(roomName);
            currentRoom = roomName;
            currentIdentity = participantId;
            io.to(roomName).emit("participantJoined", { participantId });
            // Initialize room state if it doesn't exist
            if (!roomStates[roomName]) {
                roomStates[roomName] = {
                    currentTime: 0,
                    executedActions: new Set(),
                    guestRequests: [],
                    participants: new Set(),
                };
                startRoomTimer(roomName);
                guestRequests[roomName] = [];
            }
            // Add participant and sync their time
            roomStates[roomName].participants.add(participantId);
            socket.emit("initialSync", {
                currentTime: roomStates[roomName].currentTime,
                executedActions: Array.from(roomStates[roomName].executedActions),
                joinTime: roomStates[roomName].currentTime,
            });
            // Update guest requests for all users in the room
            io.to(roomName).emit("guestRequestsUpdate", guestRequests[roomName]);
        });
        socket.on("requestToSpeak", ({ participantId, name, roomName, walletAddress }) => {
            const newRequest = { participantId, name, walletAddress };
            if (!guestRequests[roomName].some(req => req.participantId === participantId)) {
                guestRequests[roomName].push(newRequest);
                io.to(roomName).emit("guestRequestsUpdate", guestRequests[roomName]);
            }
        });
        socket.on("inviteGuest", ({ participantId, roomName }) => {
            guestRequests[roomName] = guestRequests[roomName].filter((req) => req.participantId !== participantId);
            io.to(roomName).emit("guestRequestsUpdate", guestRequests[roomName]);
        });
        socket.on("returnToGuest", ({ participantId, roomName }) => {
            guestRequests[roomName] = guestRequests[roomName].filter((req) => req.participantId !== participantId);
            io.to(roomName).emit("guestRequestsUpdate", guestRequests[roomName]);
        });
        socket.on("actionExecuted", ({ roomName, actionId }) => {
            if (roomStates[roomName]) {
                roomStates[roomName].executedActions.add(actionId);
                io.to(roomName).emit("actionExecutedSync", actionId);
            }
        });
        socket.on("sendReaction", ({ roomName, reaction, sender }) => {
            io.to(roomName).emit("receiveReaction", { reaction, sender });
        });
        socket.on("disconnect", () => {
            if (currentRoom && currentIdentity) {
                io.to(currentRoom).emit("participantLeft", { participantId: currentIdentity });
                // Remove participant from room state
                if (roomStates[currentRoom]) {
                    roomStates[currentRoom].participants.delete(currentIdentity);
                    // Remove participant's request from guest requests
                    if (guestRequests[currentRoom]) {
                        guestRequests[currentRoom] = guestRequests[currentRoom].filter((req) => req.participantId !== currentIdentity);
                        // Emit updated guest requests to all users in the room
                        io.to(currentRoom).emit("guestRequestsUpdate", guestRequests[currentRoom]);
                    }
                    // Clean up empty room
                    if (roomStates[currentRoom].participants.size === 0) {
                        delete roomStates[currentRoom];
                        delete guestRequests[currentRoom];
                    }
                }
            }
            // console.log("A user disconnected", socket.id);
        });
    });
    return io;
};
export default createSocketServer;
