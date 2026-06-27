import express from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";

const router = express.Router();
router.use(requireAuth);

const CATEGORY_MAP = {
  programs: {
    table: "master_programs",
    id: "program_id",
    name: "program_name",
    price: "default_price"
  },
  addons: {
    table: "master_addons",
    id: "addon_id",
    name: "addon_name",
    price: "default_price"
  },
  agents: {
    table: "master_agents",
    id: "agent_id",
    name: "agent_name"
  },
  boats: {
    table: "master_boats",
    id: "boat_id",
    name: "boat_name"
  },
  islands: {
    table: "master_islands",
    id: "island_id",
    name: "island_name"
  },
  price_reasons: {
    table: "master_price_reasons",
    id: "reason_id",
    name: "reason_name"
  },
  payment_methods: {
    table: "master_payment_methods",
    id: "method_id",
    name: "method_name"
  },
  statuses: {
    table: "master_statuses",
    id: "status_id",
    name: "status_name"
  }
};

function getConfig(category) {
  const cfg = CATEGORY_MAP[category];
  if (!cfg) throw new Error("Invalid master data category");
  return cfg;
}

function toDbPayload(cfg, body) {
  const payload = {
    [cfg.id]: body.code,
    [cfg.name]: body.name,
    active_flag: body.active_flag !== false,
    sort_order: body.sort_order || 0,
    description: body.description || "",
    updated_at: new Date().toISOString()
  };

  if (cfg.price) payload[cfg.price] = body.default_price || 0;

  return payload;
}

router.get("/:category", async (req, res) => {
  try {
    const cfg = getConfig(req.params.category);

    const { data, error } = await supabaseAdmin
      .from(cfg.table)
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:category", requirePermission("editMasterData"), async (req, res) => {
  try {
    const cfg = getConfig(req.params.category);
    const payload = toDbPayload(cfg, req.body);

    const { data, error } = await supabaseAdmin
      .from(cfg.table)
      .upsert(payload, { onConflict: cfg.id })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/:category/:id", requirePermission("editMasterData"), async (req, res) => {
  try {
    const cfg = getConfig(req.params.category);
    const payload = toDbPayload(cfg, { ...req.body, code: req.params.id });

    const { data, error } = await supabaseAdmin
      .from(cfg.table)
      .update(payload)
      .eq(cfg.id, req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
