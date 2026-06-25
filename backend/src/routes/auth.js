import express from "express";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "../services/supabase.js";

const router = express.Router();

router.post("/login", async (req,res)=>{
  const { username, password } = req.body;

  // Prototype login: app_users table + password from .env/demo.
  // Production: replace with Supabase Auth or hashed password table.
  const { data:user, error } = await supabaseAdmin
    .from("app_users")
    .select("user_id, username, display_name, role_id, active_flag")
    .eq("username", username)
    .maybeSingle();

  if(error) return res.status(500).json({error:error.message});
  if(!user || !user.active_flag) return res.status(401).json({error:"User not found or inactive"});

  const demoPassword = process.env.DEMO_PASSWORD || "1234";
  if(password !== demoPassword) return res.status(401).json({error:"Invalid password"});

  const { data:permRows, error:permError } = await supabaseAdmin
    .from("role_permissions")
    .select("permission_key, allowed")
    .eq("role_id", user.role_id);

  if(permError) return res.status(500).json({error:permError.message});

  const permissions = {};
  for(const p of permRows || []) permissions[p.permission_key] = p.allowed;

  const payload = {
    userId: user.user_id,
    username: user.username,
    displayName: user.display_name,
    role: user.role_id,
    permissions
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET || "dev-secret", { expiresIn:"12h" });
  res.json({token, user: payload});
});

export default router;
