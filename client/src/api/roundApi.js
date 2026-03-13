import axiosInstance from "./axiosInstance";

export const getRounds = () => axiosInstance.get("/round");

export const getRoundSummary = () => axiosInstance.get("/round/summary");

export const getLeaderBoard = () => axiosInstance.get("/round/leaderboard");

export const refreshLeaderBoard = () =>
  axiosInstance.post("/round/refresh-leaderboard");

export const createRound = ({ roundName, roundStatus }) =>
  axiosInstance.post("/round/create", { roundName, roundStatus });

export const updateRoundName = ({ roundId, roundName }) =>
  axiosInstance.post(`/round/update/${roundId}`, { roundName });

export const updateRoundStatus = ({ roundId, status }) =>
  axiosInstance.post(`/round/update-status/${roundId}`, { status });
