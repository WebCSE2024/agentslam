import { Router } from "express";
import publicMatchController from "../controllers/publicMatch.controller.js";

const router = Router();

router.get("/all-match", publicMatchController.getAllMatches);
router.get("/match/:id", publicMatchController.getMatchById);

export default router;