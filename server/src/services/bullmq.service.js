import bullmq from 'bullmq';
import matchController from '../controllers/match.controller.js';
import matchModel from '../models/match.model.js';
const { Queue, Worker } = bullmq;

class BullMQService {

    constructor() {
        this.resultqueue = new Queue('result-req', {
            connection: {
                url: process.env.REDIS_URI
            }
        });
        this.resultWorker = new Worker('result-req', async (job)=>{   //this expects job.data as --->{matchId, result:{scores:{team1, team2}, winner}}

            switch(job.name){
                case 'process-match-result':
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

    init() {

        this.resultWorker.on("completed", (job) => {
        console.log(`Job ${job.id} completed`);
        });

        this.resultWorker.on("failed", (job, err) => {
        console.error(`Job ${job?.id} failed:`, err);
        });

        this.resultWorker.on("error", (err) => {
        console.error("Worker error:", err);
        });

    }

    async addResultJob(matchId) {
        const match = await matchModel.findById(matchId).lean();
        
        if(!match){
            console.error(`Match with ID ${matchId} not found. Cannot add result job.`);
            return;
        }

        const data = {
            matchId,
            conversations: match.conversations
        };
        await this.resultqueue.add("process-match-result", data);
    }

    resetQueue = async () => {
        await this.resultqueue.obliterate({ force: true });
        console.log("BullMQ queues have been reset.");
    }
}

export default new BullMQService();