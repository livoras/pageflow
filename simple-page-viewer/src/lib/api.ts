const API_BASE_URL = 'http://localhost:3100';

export interface Recording {
  id: string;
  name: string;
  description: string;
  actionsCount: number;
  lastAction: string | null;
  createdAt: string;
}

export interface RecordingDetail {
  id: string;
  name?: string;
  description: string;
  actions: Action[];
  basePath: string;
  dataPath: string;
}

export interface Action {
  type: string;
  url?: string;
  method?: string;
  xpath?: string;
  selector?: string;
  args?: string[];
  description?: string;
  timestamp: number;
  timeout?: number;
  structure?: string;
  xpathMap?: string;
  screenshot?: string;
  listFile?: string;
  elementFile?: string;
  count?: number;
}

export async function fetchRecordings(): Promise<Recording[]> {
  const response = await fetch(`${API_BASE_URL}/api/recordings`);
  if (!response.ok) {
    throw new Error('Failed to fetch recordings');
  }
  return response.json();
}

export async function fetchRecording(id: string): Promise<RecordingDetail> {
  const response = await fetch(`${API_BASE_URL}/api/recordings/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch recording');
  }
  return response.json();
}

export function getScreenshotUrl(recordingId: string, filename: string): string {
  return `${API_BASE_URL}/api/recordings/${recordingId}/files/${filename}`;
}

export async function replayActions(actions: Action[], options?: {
  delay?: number;
  verbose?: boolean;
  continueOnError?: boolean;
}): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/replay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      actions,
      options: options || {}
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to replay actions');
  }
  
  return response.json();
}

export async function deleteAction(pageId: string, actionIndex: number): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/pages/${pageId}/actions/${actionIndex}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete action');
  }
  
  return response.json();
}

export async function deleteRecording(recordingId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/pages/${recordingId}/records`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete recording');
  }
  
  return response.json();
}