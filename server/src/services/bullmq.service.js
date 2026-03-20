import bullmq from 'bullmq';
import matchController from '../controllers/match.controller.js';
import matchModel from '../models/match.model.js';
import { logInfo } from '../utils/logger.js';
import { TOPIC_TYPE } from '../utils/enum.js';
const { Queue, Worker } = bullmq;

class BullMQService {

    constructor() {
        // console.log("Entering file with: ", process.env.REDIS_URI)
        this.resultqueue = new Queue('result-req', {
            connection: {
                url: process.env.REDIS_URI
            }
        });
        this.resultWorker = new Worker('result-req', async (job)=>{   //this expects job.data as --->{matchId, result:{scores:{team1, team2}, winner:{'team1' or 'team2'}}}

            switch(job.name){
                case 'match-result-request': {
                    const { matchId, conversations = [] } = job.data;
                    console.log(`Mock processing requested for match ${matchId}`);
                    console.log(`Conversation length: ${conversations.length}`);

                    // mock delay before publishing the computed result
                    await new Promise((resolve) => setTimeout(resolve, 15000));

                    const team1 = this.getRandomScore();
                    const team2 = this.getRandomScore();
                    const winner = team1 === team2
                        ? (Math.random() < 0.5 ? 'team1' : 'team2')
                        : (team1 > team2 ? 'team1' : 'team2');

                    await this.resultqueue.add('match-result', {
                        matchId,
                        result: {
                            scores: { team1, team2 },
                            winner
                        }
                    });

                    console.log(`Mock result enqueued for match ${matchId}`);
                    break;
                }
                case 'match-result':
                    const { matchId } = job.data;
                    console.log(`Processing result for match ${matchId}`);
                    try {
                        // updateMatchResult is the single source of truth:
                        // saves result, populates, clears cache, broadcasts socket,
                        // disables loser, invalidates session, updates leaderboard, sends emails
                        await matchController.updateMatchResult(matchId, job.data.result);
                        console.log(`Match ${matchId} fully processed.`);
                    } catch (error) {
                        console.error(`Error processing match ${matchId} result:`, error);
                    }
                    break;
                default:
                    console.warn(`Unknown job type: ${job.name}`);
            }
        }, 
        {
            connection:{
                url: process.env.REDIS_URI
            }
        })
        
        console.log('BullMQ Configured')

    }

    getRandomScore() {
        return Math.floor(Math.random() * 51) + 50;
    }

    init() {

        this.resultWorker.on("completed", (job) => {
            logInfo(`Job ${job.id} completed`);
        });

        this.resultWorker.on("failed", (job, err) => {
            console.error(`Job ${job?.id} failed:`, err);
        });

        this.resultWorker.on("error", (err) => {
            console.error("Worker error:", err);
        });

    }

    async addResultJob(matchId) {
        const match = await matchModel.findById(matchId).populate('topic').lean();
        
        if(!match){
            console.error(`Match with ID ${matchId} not found. Cannot add result job.`);
            return;
        }

        const data = {
            matchId,
            for_the_motion: opponents.team1.topicType === TOPIC_TYPE.PROS ? 'team1' : 'team2',
            against_the_motion: opponents.team1.topicType === TOPIC_TYPE.CONS ? 'team1' : 'team2',
            topic: match.topic.title,
            description: match.topic.description,
            conversations: match.conversations.map((conv) => ({
                teamId: conv.team,
                message: conv.message,
                timestamp: conv.timestamp,
            }))
        };
        await this.resultqueue.add("match-result-request", data);
    }

    resetQueue = async () => {
        await this.resultqueue.obliterate({ force: true });
        console.log("BullMQ queues have been reset.");
    }
}

export default new BullMQService();