import React, { useState, useEffect } from "react";
import axios from "axios";
import "./FileUpload.css";

const App = () => {
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState("");
  const [actionPoints, setActionPoints] = useState(""); // State for action points
  const [loading, setLoading] = useState(false);
  const [option, setOption] = useState("transcription");
  const [transcripts, setTranscripts] = useState([]);
  const [showMoreIndex, setShowMoreIndex] = useState(-1);
  const [name, setName] = useState("");

  useEffect(() => {
    const fetchTranscripts = async () => {
      try {
        const response = await axios.get(
          "http://localhost:5000/api/transcripts"
        );
        setTranscripts(response.data);
      } catch (error) {
        console.error("Error fetching transcripts:", error);
      }
    };

    fetchTranscripts();
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      console.error("No file selected.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);

    try {
      const response = await axios.post(
        "http://localhost:5000/api/process-file",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const newTranscript = {
        fileName: file.name,
        transcript: response.data.transcript,
        name: name,
        task: option,
      };

      if (option === "summarization") {
        const summaryResponse = await axios.post(
          "http://localhost:5000/api/summarize",
          { text: response.data.transcript }
        );
        newTranscript.summary = summaryResponse.data.summary;
        setSummary(summaryResponse.data.summary);
      } else if (option === "action-points") {
        // Handle action-points
        const actionPointsResponse = await axios.post(
          "http://localhost:5000/api/action-points",
          { text: response.data.transcript }
        );
        newTranscript.actionPoints = actionPointsResponse.data.actionPoints;
        setActionPoints(actionPointsResponse.data.actionPoints);
      } else {
        // Reset summary and action points if the option is not summarization or action-points
        setSummary("");
        setActionPoints("");
      }

      await axios.post(
        "http://localhost:5000/api/save-transcript",
        newTranscript
      );

      const updatedTranscripts = [...transcripts, newTranscript];
      setTranscripts(updatedTranscripts);
    } catch (error) {
      console.error("Error uploading file:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionChange = (e) => {
    setOption(e.target.value);
  };

  const removeTranscript = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/api/transcripts/${id}`);
      const updatedTranscripts = transcripts.filter((t) => t._id !== id);
      setTranscripts(updatedTranscripts);
    } catch (error) {
      console.error("Error removing transcript:", error);
    }
  };

  const toggleShowMore = (id) => {
    setShowMoreIndex(showMoreIndex === id ? -1 : id);
  };

  const removeAllTranscript = async () => {
    try {
      await axios.delete("http://localhost:5000/api/transcripts/");
      setTranscripts([]);
    } catch (error) {
      console.error("Error removing transcripts:", error);
    }
  };

  return (
    <div className="appContainer">
      <div className="inputSection">
        <h2 className="header">File Upload & Processing</h2>
        <form onSubmit={handleSubmit} className="form">
          <input
            className="input"
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <input
            className="input"
            type="file"
            accept="audio/*,.txt"
            onChange={handleFileChange}
          />

          <select
            value={option}
            onChange={handleOptionChange}
            className="select"
          >
            <option value="transcription">Transcription</option>
            <option value="summarization">Summarization</option>
            <option value="action-points">Action Points</option>
          </select>

          <button type="submit" disabled={loading} className="button">
            {loading ? "Processing..." : "Upload & Process"}
          </button>
        </form>

        {loading && <div className="loading">Loading...</div>}

        {option === "transcription" && (
          <div>
            <h3>Transcript:</h3>
            <p>{transcripts[transcripts.length - 1]?.transcript}</p>
          </div>
        )}
        {option === "summarization" && summary && (
          <div className="resultSection">
            <h4>Summary:</h4>
            <p>{summary}</p>
          </div>
        )}
        {option === "action-points" && actionPoints && (
          <div className="resultSection">
            <h4>Action Points:</h4>
            <ul>
              {actionPoints.split("\n").map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="transcriptsSection">
        <h3>Previous Transcripts/Summary/Action Points</h3>
        {transcripts.length === 0 ? (
          <p>No previous transcripts available.</p>
        ) : (
          <ul className="TranscriptList">
            {transcripts.map((t) => (
              <li key={t._id} className="transcriptItem">
                <div className="transcriptInfo">
                  <strong>File Name:</strong> {t.fileName} <br />
                  <strong>Task:</strong> {t.task} <br />
                  <strong>Name:</strong> {t.name} <br />
                </div>
                <button
                  onClick={() => removeTranscript(t._id)}
                  className="removeButton"
                >
                  Remove
                </button>
                <button
                  onClick={() => toggleShowMore(t._id)}
                  className="showMoreButton"
                >
                  {showMoreIndex === t._id ? "Show Less" : "Show More"}
                </button>
                {showMoreIndex === t._id && (
                  <div className="transcriptDetails">
                    <p>
                      <strong>Full Transcript:</strong>
                    </p>
                    <p>{t.transcript}</p>
                    {t.summary && (
                      <>
                        <p>
                          <strong>Summary:</strong>
                        </p>
                        <p>{t.summary}</p>
                      </>
                    )}
                    {t.actionPoints && (
                      <>
                        <p>
                          <strong>Action Points:</strong>
                        </p>
                        <ul>
                          {t.actionPoints.split("\n").map((point, index) => (
                            <li key={index}>{point}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {transcripts.length > 0 && (
          <button onClick={removeAllTranscript} className="clearAllButton">
            Clear All Transcripts
          </button>
        )}
      </div>
    </div>
  );
};

export default App;
