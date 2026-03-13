import axiosInstance from "./axiosInstance";

export const resetAllSystem = () => axiosInstance.post("/reset/all");

export const resetTournament = () => axiosInstance.post("/reset/tournament");
