import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Define __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend root .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import your Lesson model (Ensure the file extension .js is included)
import Lesson from '../model/Lesson.js'; // Adjust path/folder name if your model folder is 'models/Lesson.js'

const cleanExistingLessons = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.DATABASE_URL;
    
    if (!mongoUri) {
      throw new Error("MongoDB connection URI not found in process.env");
    }

    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB successfully...");

    const lessons = await Lesson.find({ quiz: { $exists: true, $not: { $size: 0 } } });
    let updatedCount = 0;

    for (let lesson of lessons) {
      let isModified = false;

      const cleanedQuiz = lesson.quiz.map(q => {
        const trimmedQuestion = q.question ? q.question.trim() : '';
        const trimmedAnswer = q.answer ? q.answer.trim() : '';
        const trimmedExplanation = q.explanation ? q.explanation.trim() : '';
        const trimmedOptions = (q.options || []).map(opt => typeof opt === 'string' ? opt.trim() : opt);

        if (
          trimmedQuestion !== q.question ||
          trimmedAnswer !== q.answer ||
          trimmedExplanation !== q.explanation ||
          JSON.stringify(trimmedOptions) !== JSON.stringify(q.options)
        ) {
          isModified = true;
        }

        return {
          ...q.toObject(),
          question: trimmedQuestion,
          answer: trimmedAnswer,
          explanation: trimmedExplanation,
          options: trimmedOptions
        };
      });

      if (isModified) {
        lesson.quiz = cleanedQuiz;
        await lesson.save();
        updatedCount++;
      }
    }

    console.log(`Successfully cleaned quiz whitespace in ${updatedCount} existing lesson document(s).`);
    process.exit(0);
  } catch (error) {
    console.error("Error cleaning existing lessons:", error);
    process.exit(1);
  }
};

cleanExistingLessons();