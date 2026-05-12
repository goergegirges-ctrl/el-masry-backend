import { supabase } from "../config/supabaseClient.js";
import jwt from "jsonwebtoken";

export const getNotifications = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        res.json({ success: true, notifications: data || [] });
    } catch (err) {
        console.error("getNotifications error:", err);
        res.status(500).json({ success: false, message: "Failed to fetch notifications" });
    }
};

export const markAllRead = async (req, res) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('is_read', false);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error("markAllRead error:", err);
        res.status(500).json({ success: false, message: "Failed to mark notifications as read" });
    }
};

// SSE stream — token passed as ?token= query param because EventSource
// cannot set custom request headers. Unlike authAdmin, this only verifies
// the JWT signature once at connection time and does NOT re-query users.role
// on each poll — intentional: a persistent SSE connection cannot realistically
// re-run a DB check every 10 s without adding disproportionate load, and a
// compromised token already expires in 15 min (forcing a reconnect + re-check).
export const streamNotifications = async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(401).end();

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload.role !== 'admin') return res.status(403).end();
    } catch {
        return res.status(401).end();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering on Railway
    res.flushHeaders();

    const send = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send('connected', { timestamp: new Date().toISOString() });

    let lastCheckedAt = new Date().toISOString();
    let heartbeatTick = 0;

    const interval = setInterval(async () => {
        try {
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .gt('created_at', lastCheckedAt)
                .order('created_at', { ascending: true });

            if (data && data.length > 0) {
                lastCheckedAt = data[data.length - 1].created_at;
                for (const n of data) {
                    send('notification', n);
                }
            }
        } catch { /* swallow — connection may be closing */ }

        // Heartbeat every ~30 s (3 × 10 s interval)
        heartbeatTick++;
        if (heartbeatTick % 3 === 0) {
            send('heartbeat', { timestamp: new Date().toISOString() });
        }
    }, 10_000);

    req.on('close', () => {
        clearInterval(interval);
        res.end();
    });
};
