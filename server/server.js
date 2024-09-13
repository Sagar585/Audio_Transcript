import express from 'express';
import multer from 'multer';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import OpenAI from 'openai';
import Transcript from './models/Transcript.js'; // Import the Transcript model

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// MongoDB setup
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err.message);
  });

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// Process file route (Transcription)
app.post('/api/process-file', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).send('No file uploaded.');
    }

    const filePath = file.path;
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (fileExtension === '.txt') {
      // Handle text file
      const textData = fs.readFileSync(filePath, 'utf-8');
      fs.unlinkSync(filePath); // Clean up uploaded file
      return res.json({ transcript: textData });
    } else if (file.mimetype.startsWith('audio/')) {
      // Handle audio file (for transcription)
      const fileData = fs.readFileSync(filePath);

      // Upload file to AssemblyAI
      const uploadResponse = await axios.post('https://api.assemblyai.com/v2/upload', fileData, {
        headers: {
          'authorization': process.env.ASSEMBLYAI_API_KEY,
          'Content-Type': 'audio/mpeg',
        },
      });

      const audioUrl = uploadResponse.data.upload_url;

      // Request transcription
      const transcriptionResponse = await axios.post('https://api.assemblyai.com/v2/transcript', {
        audio_url: audioUrl,
      }, {
        headers: {
          'authorization': process.env.ASSEMBLYAI_API_KEY,
        },
      });

      const transcriptId = transcriptionResponse.data.id;

      // Poll for the transcription result
      let transcriptResult;
      do {
        await new Promise(resolve => setTimeout(resolve, 5000)); 
        const result = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
          headers: {
            'authorization': process.env.ASSEMBLYAI_API_KEY,
          },
        });
        transcriptResult = result.data;
      } while (transcriptResult.status !== 'completed');

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      const transcriptText = transcriptResult.text;
      return res.json({ transcript: transcriptText });
    } else {
      // Unsupported file type
      fs.unlinkSync(filePath);
      return res.status(400).send('Unsupported file type.');
    }
  } catch (error) {
    console.error('Error processing file:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

// Summarize text route
app.post('/api/summarize', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).send('No text provided.');
    }

    // Generate summary using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{
        role: 'user',
        content: `Please summarize the following text:\n\n${text}`,
      }],
      max_tokens: 150,
      temperature: 0.5,
    });

    const summary = completion.choices[0].message.content.trim();
    res.json({ summary });
  } catch (error) {
    console.error('Error summarizing text:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

// Extract action points route
app.post('/api/action-points', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).send('No text provided.');
    }

    // Extract action points using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{
        role: 'user',
        content: `Please extract action points from the following text and list them:\n\n${text}`,
      }],
      max_tokens: 150,
      temperature: 0.5,
    });

    const actionPoints = completion.choices[0].message.content.trim();
    res.json({ actionPoints });
  } catch (error) {
    console.error('Error extracting action points:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

// Save transcript to MongoDB route
app.post('/api/save-transcript', async (req, res) => {
  try {
    const { fileName, transcript, name, task, summary, actionPoints } = req.body;

    if (!fileName || !transcript || !name || !task) {
      return res.status(400).send('Missing required fields.');
    }

    const newTranscript = new Transcript({
      fileName,
      transcript,
      name,
      task,
      summary,
      actionPoints, // Add actionPoints here
    });

    await newTranscript.save();
    res.status(200).json(newTranscript);
  } catch (error) {
    console.error('Error saving transcript:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch all transcripts route
app.get('/api/transcripts', async (req, res) => {
  try {
    const transcripts = await Transcript.find();
    res.status(200).json(transcripts);
  } catch (error) {
    console.error('Error fetching transcripts:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

// Delete transcript route
app.delete('/api/transcripts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Transcript.findByIdAndDelete(id);
    res.status(200).send('Transcript deleted successfully.');
  } catch (error) {
    console.error('Error deleting transcript:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

// Delete all transcripts route
app.delete('/api/transcripts', async (req, res) => {
  try {
    await Transcript.deleteMany({});
    res.status(200).send('All transcripts deleted successfully.');
  } catch (error) {
    console.error('Error deleting transcripts:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
