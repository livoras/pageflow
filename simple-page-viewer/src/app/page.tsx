'use client';

import { useEffect, useState } from 'react';
import { Recording, RecordingDetail, fetchRecordings, fetchRecording, getScreenshotUrl } from '@/lib/api';
import { useSearchParams } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function Home() {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('id');
  
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<RecordingDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);
  
  // Connect to WebSocket
  const { on } = useWebSocket('ws://localhost:3100/ws');

  // Set up WebSocket event handlers
  useEffect(() => {
    // Listen for new page creation
    const unsubPageCreated = on('page-created', async (data) => {
      console.log('New page created:', data);
      // Refresh the recordings list
      try {
        const recordings = await fetchRecordings();
        setRecordings(recordings);
        // Auto-select the new page
        handleRecordingClick(data.id);
      } catch (err: any) {
        setError(err.message);
      }
    });

    // Listen for action updates
    const unsubActionRecorded = on('action-recorded', async (data) => {
      console.log('Action recorded:', data);
      // If this action is for the currently selected recording, refresh it
      if (selectedId && data.pageId === selectedId) {
        try {
          const recording = await fetchRecording(selectedId);
          setSelectedRecording(recording);
        } catch (err: any) {
          setError(err.message);
        }
      }
    });

    return () => {
      unsubPageCreated();
      unsubActionRecorded();
    };
  }, [on, selectedId]);

  // Fetch recordings list
  useEffect(() => {
    fetchRecordings()
      .then(setRecordings)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingList(false));
  }, []);

  // Fetch selected recording detail
  useEffect(() => {
    if (selectedId) {
      setLoadingDetail(true);
      fetchRecording(selectedId)
        .then((data) => {
          // Check if recording is disabled
          if (data.recordingEnabled === false) {
            setSelectedRecording(null);
            setError(data.message || 'Recording not available');
          } else {
            setSelectedRecording(data);
            setError(null);
          }
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoadingDetail(false));
    } else {
      setSelectedRecording(null);
    }
  }, [selectedId]);

  const handleRecordingClick = (id: string) => {
    const newParams = new URLSearchParams();
    newParams.set('id', id);
    window.history.pushState(null, '', `?${newParams.toString()}`);
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-80 border-r bg-gray-50 overflow-y-auto">
        <h2 className="text-xl font-bold p-4 border-b">Recordings</h2>
        {loadingList ? (
          <div className="p-4">Loading...</div>
        ) : error ? (
          <div className="p-4 text-red-500">Error: {error}</div>
        ) : recordings.length === 0 ? (
          <div className="p-4 text-gray-500">No recordings found</div>
        ) : (
          <div>
            {recordings.map((recording) => (
              <button
                key={recording.id}
                onClick={() => handleRecordingClick(recording.id)}
                className={`relative w-full text-left p-4 border-b hover:bg-gray-100 transition-colors ${
                  selectedId === recording.id ? 'bg-blue-50' : ''
                }`}
              >
                {selectedId === recording.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                )}
                <div className="font-medium">{recording.name}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {recording.actionsCount} actions
                  {recording.lastAction && ` • ${recording.lastAction}`}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(recording.createdAt).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {loadingDetail ? (
          <div className="p-8">Loading recording details...</div>
        ) : selectedRecording ? (
          <div className="p-8">
            <h1 className="text-2xl font-bold mb-2">{selectedRecording.name || selectedRecording.description}</h1>
            <p className="text-gray-600 mb-6">ID: {selectedRecording.id}</p>
            
            <div className="space-y-4">
              {selectedRecording.actions.map((action, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold inline">
                        {index + 1}. {action.type}{action.method ? ` · ${action.method}` : ''}
                      </h3>
                      {action.description && (
                        <span className="text-gray-600 ml-2">{action.description}</span>
                      )}
                      <span className="text-xs text-gray-500 ml-2">
                        {new Date(action.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-1 text-xs">
                    {action.url && (
                      <div className="truncate">
                        <span className="font-medium">URL:</span> {action.url}
                      </div>
                    )}
                    {action.xpath && (
                      <div className="truncate">
                        <span className="font-medium">XPath:</span> 
                        <code className="ml-1 bg-gray-100 px-1 rounded">{action.xpath}</code>
                      </div>
                    )}
                    {action.args && action.args.length > 0 && (
                      <div className="truncate">
                        <span className="font-medium">Args:</span> 
                        <code className="ml-1 bg-gray-100 px-1 rounded">
                          {JSON.stringify(action.args)}
                        </code>
                      </div>
                    )}
                  </div>
                  
                  {action.screenshot && action.type !== 'create' && (
                    <div className="mt-2">
                      <img
                        src={getScreenshotUrl(selectedRecording.id, action.screenshot)}
                        alt={`Screenshot for ${action.type}`}
                        className="w-48 h-auto border rounded shadow-sm cursor-pointer hover:opacity-80"
                        onClick={() => setModalImage(getScreenshotUrl(selectedRecording.id, action.screenshot))}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a recording from the sidebar to view details
          </div>
        )}
      </div>
      
      {/* Image Modal */}
      {modalImage && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-8"
          onClick={() => setModalImage(null)}
        >
          <div className="max-w-full max-h-full overflow-auto">
            <img 
              src={modalImage} 
              alt="Full size screenshot"
              className="max-w-full h-auto"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}