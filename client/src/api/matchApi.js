import axiosInstance from "./axiosInstance";

export const getAllMatches = () => axiosInstance.get("/match");

export const getAllMatchesAdmin = () => axiosInstance.get("/match/admin");

export const generateMatches = (currRoundId) =>
	axiosInstance.post("/match/generate", { currRoundId });

export const activateMatch = (matchId) =>
	axiosInstance.post(`/match/activate/${matchId}`);

export const getMatchInfo = (matchId) =>
	axiosInstance.get(`/match/${matchId}`);

export const startMatch = (matchId) =>
	axiosInstance.post(`/match/start/${matchId}`);

export const pauseMatch = (matchId) =>
	axiosInstance.post(`/match/pause/${matchId}`);

export const resumeMatch = (matchId) =>
	axiosInstance.post(`/match/resume/${matchId}`);
