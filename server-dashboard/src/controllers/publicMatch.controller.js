import matchModel from "../models/match.model.js";
import { MATCH_STATUS, TOPIC_TYPE } from "../utils/enum.js";
import "../models/user.model.js";
import "../models/topic.model.js";
import "../models/round.model.js";

function toRoundWise(matches = []) {
  const grouped = new Map();

  for (const match of matches) {
    const roundId = String(match?.round?._id || "unknown");

    if (!grouped.has(roundId)) {
      grouped.set(roundId, {
        roundId,
        roundName: match?.round?.roundName || "Unknown Round",
        roundStatus: match?.round?.roundStatus || "unknown",
        roundCreatedAt: match?.round?.createdAt || null,
        matches: [],
      });
    }

    grouped.get(roundId).matches.push({
      _id: match?._id,
      team1: match?.opponents?.team1?.user?.name || "Team 1",
      team2: match?.opponents?.team2?.user?.name || "Team 2",
      matchStatus: match?.matchStatus || MATCH_STATUS.PENDING,
      winner: match?.winner?.name || null,
      scores: match?.scores || { team1: 0, team2: 0 },
      createdAt: match?.createdAt || null,
    });
  }

  return Array.from(grouped.values())
    .sort((a, b) => new Date(b.roundCreatedAt || 0).getTime() - new Date(a.roundCreatedAt || 0).getTime())
    .map((group) => ({
      ...group,
      matches: [...group.matches].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
    }));
}

class PublicMatchController {
  getAllMatches = async (req, res, next) => {
    try {
      const matches = await matchModel
        .find({})
        .select("opponents.team1.user opponents.team2.user round matchStatus scores winner createdAt")
        .populate("opponents.team1.user", "_id name")
        .populate("opponents.team2.user", "_id name")
        .populate("round", "_id roundName roundStatus createdAt")
        .populate("winner", "_id name")
        .lean();

      return res.status(200).json({
        success: true,
        data: toRoundWise(matches),
      });
    } catch (err) {
      return next(err);
    }
  };

  getMatchById = async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ success: false, message: "Match id is required" });
      }

      const match = await matchModel
        .findById(id)
        .populate("opponents.team1.user", "_id name")
        .populate("opponents.team2.user", "_id name")
        .populate("topic", "_id title description")
        .populate("round", "_id roundName roundStatus")
        .populate("winner", "_id name")
        .populate("conversations.user", "_id name")
        .lean();

      if (!match) {
        return res.status(404).json({ success: false, message: "Match not found" });
      }

      if (match.matchStatus === MATCH_STATUS.PENDING) {
        return res.status(400).json({ success: false, message: "Match is not active yet" });
      }

      const prosTeam = match?.opponents?.team1?.topicType === TOPIC_TYPE.PROS ? "team1" : "team2";
      const consTeam = match?.opponents?.team1?.topicType === TOPIC_TYPE.CONS ? "team1" : "team2";

      return res.status(200).json({
        success: true,
        data: {
          _id: match._id,
          matchStatus: match.matchStatus,
          scores: match.scores,
          winner: match?.winner || null,
          round: match.round,
          topic: match.topic,
          team1: {
            key: "team1",
            user: match?.opponents?.team1?.user || null,
            topicType: match?.opponents?.team1?.topicType || null,
          },
          team2: {
            key: "team2",
            user: match?.opponents?.team2?.user || null,
            topicType: match?.opponents?.team2?.topicType || null,
          },
          prosTeam,
          consTeam,
          conversations: Array.isArray(match?.conversations)
            ? match.conversations
                .map((c) => ({
                  team: c?.team || "team1",
                  user: c?.user || null,
                  message: c?.message || "",
                  timestamp: c?.timestamp || null,
                }))
                .sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime())
            : [],
          createdAt: match.createdAt,
          updatedAt: match.updatedAt,
        },
      });
    } catch (err) {
      return next(err);
    }
  };
}

export default new PublicMatchController();