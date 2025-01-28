import { Server } from "socket.io";
import { Server as HttpServer } from "http";

type AddonType = "Custom" | "Q&A" | "Poll";

interface AddonState {
  type: AddonType;
  isActive: boolean;
  data?: any;
}

interface GuestRequest {
  participantId: string;
  name: string; // To display the participant’s name in the UI
}

interface RoomState {
  currentTime: number;
  executedActions: Set<string>;
  guestRequests: GuestRequest[];
  participants: Set<string>;
}

const roomStates: { [roomName: string]: RoomState } = {};

export const guestRequests: { [roomName: string]: GuestRequest[] } = {};

const createSocketServer = (server: HttpServer) => {
  const io = new Server(server, {
    cors: {
      origin: ["https://thestreamlink.com", "http://localhost:5173"],
    },
  });
  const activeAddons: Record<AddonType, AddonState> = {
    Custom: { type: "Custom", isActive: false },
    "Q&A": { type: "Q&A", isActive: false },
    Poll: { type: "Poll", isActive: false },
  };

  // Initialize room timer
  const startRoomTimer = (roomName: string) => {
    const interval = setInterval(() => {
      if (roomStates[roomName]) {
        roomStates[roomName].currentTime += 1;
        io.to(roomName).emit("timeSync", roomStates[roomName].currentTime);
      } else {
        clearInterval(interval);
      }
    }, 1000);
  };

  io.on("connection", (socket) => {
    console.log("A user connected", socket.id);

    let currentRoom: string | null = null;
    let currentIdentity: string | null = null;

    socket.emit("addonState", activeAddons);

    // Handle starting addons
    socket.on("startAddon", (data: { type: AddonType; data?: any }) => {
      console.log(`Starting ${data.type} addon`);
      activeAddons[data.type] = {
        type: data.type,
        isActive: true,
        data: data.data,
      };
      io.emit("addonStateUpdate", activeAddons[data.type]);
    });

    // Handle stopping addons
    socket.on("stopAddon", (type: AddonType) => {
      console.log(`Stopping ${type} addon`);
      activeAddons[type] = {
        type: type,
        isActive: false,
        data: null,
      };
      io.emit("addonStateUpdate", activeAddons[type]);
    });

    socket.on("joinRoom", (roomName: string, participantId: string) => {
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
      guestRequests[roomName] = guestRequests[roomName].filter(
        (req) => req.participantId !== participantId
      );
      io.to(roomName).emit("guestRequestsUpdate", guestRequests[roomName]);
    });

    socket.on("returnToGuest", ({ participantId, roomName }) => {
      guestRequests[roomName] = guestRequests[roomName].filter(
        (req) => req.participantId !== participantId
      );
      io.to(roomName).emit("guestRequestsUpdate", guestRequests[roomName]);
    });

    socket.on("actionExecuted", ({ roomName, actionId }) => {
      if (roomStates[roomName]) {
        roomStates[roomName].executedActions.add(actionId);
        io.to(roomName).emit("actionExecutedSync", actionId);
      }
    });

    socket.on("disconnect", () => {
      if (currentRoom && currentIdentity) {
        io.to(currentRoom).emit("participantLeft", { participantId: currentIdentity });

        // Remove participant from room state
        if (roomStates[currentRoom]) {
          roomStates[currentRoom].participants.delete(currentIdentity);

          // Remove participant's request from guest requests
          if (guestRequests[currentRoom]) {
            guestRequests[currentRoom] = guestRequests[currentRoom].filter(
              (req) => req.participantId !== currentIdentity
            );
            
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
      console.log("A user disconnected", socket.id);
    });
  });

  return io;
};

export default createSocketServer;
