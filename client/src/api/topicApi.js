import axiosInstance from "./axiosInstance";

export const createTopic = ({ title, description, round, weights }) =>
  axiosInstance.post("/topic/create", { title, description, round, weights });

export const createTopicsBatch = ({ topics }) =>
  axiosInstance.post("/topic/create/batch", { topics });

export const getTopicsByRound = (roundId) =>
  axiosInstance.get(`/topic/round/${roundId}`);

export const updateTopic = ({ topicId, title, description, weights, round }) =>
  axiosInstance.post(`/topic/update/${topicId}`, {
    title,
    description,
    weights,
    round,
  });

export const deleteTopic = (topicId) =>
  axiosInstance.delete(`/topic/${topicId}`);
