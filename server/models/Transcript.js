import mongoose from 'mongoose';

const transcriptSchema = new mongoose.Schema({
  fileName: String,
  transcript: String,
  summary: String,
  name: String,
  task: String,
  actionPoints: String, // Add actionPoints field
});

const Transcript = mongoose.model('Transcript', transcriptSchema);

export default Transcript;
