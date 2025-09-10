'use client';

import { useEffect, useState } from 'react';
import { Recording, RecordingDetail, fetchRecordings, fetchRecording, getScreenshotUrl, replayActions } from '@/lib/api';
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
  const [replayStatus, setReplayStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [replayError, setReplayError] = useState<string | null>(null);
  const [modalListData, setModalListData] = useState<{ items: string[], action: any } | null>(null);
  const [listPreviewMode, setListPreviewMode] = useState<'html' | 'preview'>('html');
  const [modalElementData, setModalElementData] = useState<{ html: string, action: any } | null>(null);
  const [elementPreviewMode, setElementPreviewMode] = useState<'html' | 'preview'>('html');
  
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

  const handleListClick = async (action: any) => {
    if (!action.listFile || !selectedRecording) return;
    
    try {
      const response = await fetch(`http://localhost:3100/api/recordings/${selectedRecording.id}/data/${action.listFile}`);
      if (!response.ok) throw new Error('Failed to fetch list data');
      
      const data = await response.json();
      setModalListData({ items: Array.isArray(data) ? data : [], action });
    } catch (error) {
      console.error('Failed to load list data:', error);
      setError('Failed to load list data');
    }
  };

  const handleElementClick = async (action: any) => {
    if (!action.elementFile || !selectedRecording) return;
    
    try {
      const response = await fetch(`http://localhost:3100/api/recordings/${selectedRecording.id}/data/${action.elementFile}`);
      if (!response.ok) throw new Error('Failed to fetch element data');
      
      const html = await response.text();
      setModalElementData({ html, action });
    } catch (error) {
      console.error('Failed to load element data:', error);
      setError('Failed to load element data');
    }
  };

  const handleReplay = async () => {
    if (!selectedRecording) return;
    
    setReplayStatus('running');
    setReplayError(null);
    
    try {
      const result = await replayActions(selectedRecording.actions, {
        delay: 1000,
        verbose: true,
        continueOnError: false
      });
      
      setReplayStatus('success');
      console.log('Replay result:', result);
      
      // Reset status after 3 seconds
      setTimeout(() => setReplayStatus('idle'), 3000);
    } catch (error) {
      setReplayStatus('error');
      setReplayError(error instanceof Error ? error.message : 'Replay failed');
      console.error('Replay error:', error);
    }
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
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold mb-2">{selectedRecording.name || selectedRecording.description}</h1>
                <p className="text-gray-600">ID: {selectedRecording.id}</p>
              </div>
              <button
                onClick={handleReplay}
                disabled={replayStatus === 'running'}
                className={`px-4 py-2 rounded transition-colors ${
                  replayStatus === 'running' 
                    ? 'bg-gray-400 text-white cursor-not-allowed' 
                    : replayStatus === 'success'
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : replayStatus === 'error'
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {replayStatus === 'running' ? 'Replaying...' : 
                 replayStatus === 'success' ? 'Success!' :
                 replayStatus === 'error' ? 'Failed' : 'Replay'}
              </button>
            </div>
            {replayError && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                Error: {replayError}
              </div>
            )}
            
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
                    {action.selector && (
                      <div className="truncate">
                        <span className="font-medium">Selector:</span> 
                        <code className="ml-1 bg-gray-100 px-1 rounded">{action.selector}</code>
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
                  
                  {action.type === 'getListHtml' && action.listFile && (
                    <div className="mt-2">
                      <button
                        onClick={() => handleListClick(action)}
                        className="text-blue-500 hover:text-blue-600 text-sm underline"
                      >
                        View List ({action.count || 0} items)
                      </button>
                    </div>
                  )}

                  {action.type === 'getListByParent' && action.listFile && (
                    <div className="mt-2">
                      <button
                        onClick={() => handleListClick(action)}
                        className="text-blue-500 hover:text-blue-600 text-sm underline"
                      >
                        View List ({action.count || 0} items)
                      </button>
                    </div>
                  )}
                  
                  {action.type === 'getElementHtml' && action.elementFile && (
                    <div className="mt-2">
                      <button
                        onClick={() => handleElementClick(action)}
                        className="text-blue-500 hover:text-blue-600 text-sm underline"
                      >
                        View Element
                      </button>
                    </div>
                  )}
                  
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
      
      {/* List Data Modal */}
      {modalListData && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-8"
          onClick={() => {
            setModalListData(null);
            setListPreviewMode('html');
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">List Data ({modalListData.items.length} items)</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    From: {modalListData.action.selector || modalListData.action.xpath || modalListData.action.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setListPreviewMode('html')}
                    className={`px-3 py-1 rounded text-sm ${
                      listPreviewMode === 'html'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    HTML
                  </button>
                  <button
                    onClick={() => setListPreviewMode('preview')}
                    className={`px-3 py-1 rounded text-sm ${
                      listPreviewMode === 'preview'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    Preview
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {listPreviewMode === 'html' ? (
                <div className="space-y-4">
                  {modalListData.items.map((item, index) => (
                    <div key={index} className="border rounded p-3 bg-gray-50">
                      <div className="text-xs text-gray-500 mb-1">Item {index + 1}</div>
                      <pre className="text-xs overflow-x-auto whitespace-pre-wrap">{item}</pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {modalListData.items.map((item, index) => (
                    <div key={index} className="border rounded p-4">
                      <div className="text-xs text-gray-500 mb-2">Item {index + 1}</div>
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: item }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setModalListData(null);
                  setListPreviewMode('html');
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Element HTML Modal */}
      {modalElementData && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-8"
          onClick={() => {
            setModalElementData(null);
            setElementPreviewMode('html');
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Element HTML</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    From: {modalElementData.action.selector || modalElementData.action.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setElementPreviewMode('html')}
                    className={`px-3 py-1 rounded text-sm ${
                      elementPreviewMode === 'html'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    HTML
                  </button>
                  <button
                    onClick={() => setElementPreviewMode('preview')}
                    className={`px-3 py-1 rounded text-sm ${
                      elementPreviewMode === 'preview'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    Preview
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {elementPreviewMode === 'html' ? (
                <div className="border rounded p-3 bg-gray-50">
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap">{modalElementData.html}</pre>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: modalElementData.html }} />
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setModalElementData(null);
                  setElementPreviewMode('html');
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}