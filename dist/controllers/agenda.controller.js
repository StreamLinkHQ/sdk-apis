import { AgendaAction } from "@prisma/client";
import { db } from "../prisma.js";
export const createAgenda = async (req, res) => {
    const { liveStreamId } = req.params;
    const { agendas } = req.body;
    const liveStreamAgendas = [];
    try {
        if (!liveStreamId || !agendas) {
            return res.status(400).json({
                error: "Missing required field",
            });
        }
        const liveStream = await db.liveStream.findFirst({
            where: {
                name: liveStreamId,
            },
        });
        if (!liveStream) {
            return res.status(400).json({
                error: `LiveStream with name ${liveStreamId} not found`,
            });
        }
        for (const agenda of agendas) {
            const actionEnum = AgendaAction[agenda.action.replace("&", "_")];
            if (!actionEnum) {
                return res
                    .status(400)
                    .json({ error: `Invalid agenda action: ${agenda.action}` });
            }
            const agendaRes = await db.agenda.create({
                data: {
                    liveStreamId: liveStream.id,
                    timeStamp: agenda.timeStamp,
                    action: actionEnum,
                    details: {
                        create: {
                            wallets: agenda.details.wallets,
                            item: agenda.details.item,
                        },
                    },
                },
                include: {
                    details: true,
                },
            });
            liveStreamAgendas.push(agendaRes);
        }
        res.status(201).json(liveStreamAgendas);
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ error });
    }
    finally {
        await db.$disconnect();
    }
};
export const getLiveStreamAgenda = async (req, res) => {
    const { liveStreamId } = req.params;
    try {
        if (!liveStreamId) {
            return res.status(400).json({
                error: "Missing required field",
            });
        }
        const liveStream = await db.liveStream.findFirst({
            where: {
                name: liveStreamId,
            },
        });
        if (!liveStream) {
            return res.status(400).json({
                error: `LiveStream with name ${liveStreamId} not found`,
            });
        }
        const allAgenda = await db.agenda.findMany({
            where: {
                liveStreamId: liveStream.id,
            },
            include: {
                details: true,
            },
        });
        res.status(200).json(allAgenda);
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ error });
    }
    finally {
        await db.$disconnect();
    }
};
export const updateLiveStreamAgenda = async (req, res) => {
    const { agendaId } = req.params;
    const agenda = req.body;
    try {
        if (!agendaId) {
            return res.status(400).json({
                error: "Missing required field",
            });
        }
        const { action, timeStamp, details } = agenda;
        const actionEnum = AgendaAction[action.replace("&", "_")];
        if (!actionEnum) {
            return res
                .status(400)
                .json({ error: `Invalid agenda action: ${action}` });
        }
        const updatedAgenda = await db.agenda.update({
            where: {
                id: agendaId,
            },
            data: {
                action: actionEnum,
                timeStamp,
                details: {
                    upsert: {
                        create: {
                            item: details.item,
                            wallets: details.wallets,
                        },
                        update: {
                            item: details.item,
                            wallets: details.wallets,
                        },
                    },
                },
            },
            include: {
                details: true,
            },
        });
        res.status(201).json(updatedAgenda);
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ error });
    }
    finally {
        await db.$disconnect();
    }
};
export const deleteAgenda = async (req, res) => {
    const { agendaId } = req.params;
    try {
        if (!agendaId) {
            return res.status(400).json({
                error: "Missing required field",
            });
        }
        const deletedAgenda = await db.agenda.delete({
            where: {
                id: agendaId,
            },
        });
        res.status(200).json({
            message: "Agenda deleted successfully",
            deletedAgenda,
        });
    }
    catch (error) {
        console.error("Error deleting agenda:", error);
        res.status(500).json({
            message: "An error occurred while deleting the agenda",
        });
    }
    finally {
        await db.$disconnect();
    }
};
