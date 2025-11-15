# KiCad Schematic Generation Service Integration Plan

## Overview
This document outlines the comprehensive implementation plan for integrating the external KiCad schematic generation service into kle-ng. The service generates KiCad schematic files (.kicad_sch) from VIA-annotated keyboard layouts.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Service Infrastructure](#service-infrastructure)
3. [Frontend Implementation](#frontend-implementation)
4. [Backend Service Updates](#backend-service-updates)
5. [Communication Protocol](#communication-protocol)
6. [Implementation Phases](#implementation-phases)
7. [Testing Strategy](#testing-strategy)
8. [Error Handling & Edge Cases](#error-handling--edge-cases)
9. [Security Considerations](#security-considerations)
10. [Deployment](#deployment)

---

## 1. Architecture Overview

### 1.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                         kle-ng (Vue 3)                      │
│  ┌──────────────┬──────────────┬──────────────┬──────────┐ │
│  │   Layout     │     Key      │     JSON     │ Schematic│ │
│  │   Editor     │  Properties  │    Editor    │ Generator│ │
│  └──────────────┴──────────────┴──────────────┴──────────┘ │
│                              ↓                               │
│                   ┌──────────────────────┐                  │
│                   │  Schematic Service   │                  │
│                   │  Client (Composable) │                  │
│                   └──────────────────────┘                  │
└─────────────────────────────┬───────────────────────────────┘
                              │
                    HTTP/WebSocket
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│            External Schematic Service (Flask)                │
│  ┌──────────────┬──────────────┬────────────────────────┐  │
│  │   Health     │   Process    │   WebSocket Progress   │  │
│  │   Endpoint   │   Endpoint   │   Handler              │  │
│  └──────────────┴──────────────┴────────────────────────┘  │
│                              ↓                               │
│              layout2schematic.py (Core Logic)               │
│                              ↓                               │
│                    kbplacer + skip libraries                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    KiCad Schematic File
```

### 1.2 Data Flow

1. **User Action**: User clicks "Generate Schematic" in the Schematic Generator section
2. **Validation**: Frontend validates that layout has matrix annotations
3. **Server Health Check**: Check if service is awake (may trigger wake-up)
4. **Job Submission**: Submit layout JSON to processing endpoint
5. **Progress Monitoring**: Establish WebSocket connection for real-time updates
6. **Processing**: Service generates schematic with progress updates
7. **Completion**: Download generated .kicad_sch file
8. **Cleanup**: Close WebSocket connection

---

## 2. Service Infrastructure

### 2.1 Render.com Free Tier Considerations

**Limitations**:
- Service spins down after 15 minutes of inactivity
- Cold start takes 30-60 seconds
- 750 hours/month free compute time
- WebSocket support available

**Solutions**:
- Implement health check endpoint (`/health` or `/ping`)
- Show "waking up service" state in UI
- Implement retry logic with exponential backoff
- Set reasonable timeouts (5 min for processing)

### 2.2 Service Endpoints Design

#### 2.2.1 Health Check Endpoint
```python
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "ok",
        "version": "1.0.0",
        "uptime": get_uptime_seconds()
    })
```

#### 2.2.2 Process Endpoint (Enhanced)
```python
@app.route("/api/process", methods=["POST"])
def process_layout():
    """
    Accepts: {
        "layout": {...},  # KLE layout JSON
        "options": {
            "switch_footprint": "",
            "diode_footprint": ""
        }
    }
    Returns: {
        "job_id": "uuid-string",
        "status": "queued|processing|completed|failed",
        "websocket_url": "ws://..."  # Optional
    }
    """
    # Validate matrix annotations exist
    # Queue job for processing
    # Return job ID for tracking
```

#### 2.2.3 Job Status Endpoint
```python
@app.route("/api/jobs/<job_id>", methods=["GET"])
def get_job_status(job_id):
    """
    Returns: {
        "job_id": "...",
        "status": "queued|processing|completed|failed",
        "progress": 0-100,
        "message": "Current step...",
        "download_url": "/api/download/<job_id>",  # When completed
        "error": "..."  # If failed
    }
    """
```

#### 2.2.4 Download Endpoint
```python
@app.route("/api/download/<job_id>", methods=["GET"])
def download_schematic(job_id):
    """
    Returns .kicad_sch file as attachment
    """
```

#### 2.2.5 WebSocket Progress Updates
```python
@socketio.on('subscribe_job')
def handle_subscribe(data):
    """
    Client subscribes to job updates
    Server emits: {
        "type": "progress",
        "job_id": "...",
        "progress": 0-100,
        "message": "Processing switch 15/42..."
    }
    """
```

### 2.3 Processing Queue Architecture

For handling concurrent requests and long-running tasks:

```python
# Simple in-memory queue (for MVP)
from queue import Queue
from threading import Thread

job_queue = Queue()
job_status = {}  # job_id -> status dict

def worker():
    while True:
        job = job_queue.get()
        process_job(job)
        job_queue.task_done()

# Start worker threads
for i in range(2):  # 2 concurrent jobs max
    t = Thread(target=worker, daemon=True)
    t.start()
```

**Future Enhancement**: Use Redis + Celery for production-grade queue

---

## 3. Frontend Implementation

### 3.1 New Section Component

**File**: `src/components/SchematicGeneratorPanel.vue`

```vue
<template>
  <div class="schematic-generator-panel">
    <!-- Status Banner -->
    <div v-if="!hasMatrixAnnotations" class="alert alert-warning">
      <i class="bi bi-exclamation-triangle"></i>
      Matrix annotations required. Please annotate your layout first.
      <button class="btn btn-sm btn-link" @click="showMatrixHelp">
        Learn how
      </button>
    </div>

    <!-- Service Status -->
    <div class="service-status mb-3">
      <div class="d-flex align-items-center gap-2">
        <div
          class="status-indicator"
          :class="serviceStatusClass"
        ></div>
        <span class="small">{{ serviceStatusText }}</span>
        <button
          v-if="serviceStatus === 'sleeping'"
          class="btn btn-sm btn-outline-primary"
          @click="wakeService"
          :disabled="isWakingService"
        >
          {{ isWakingService ? 'Waking...' : 'Wake Service' }}
        </button>
      </div>
    </div>

    <!-- Configuration Options -->
    <div class="card mb-3">
      <div class="card-header">
        <h6 class="mb-0">Schematic Options</h6>
      </div>
      <div class="card-body">
        <div class="mb-3">
          <label class="form-label">Switch Footprint (Optional)</label>
          <input
            v-model="options.switchFootprint"
            type="text"
            class="form-control"
            placeholder="e.g., MX_Only:MXOnly-1U"
          />
          <small class="form-text text-muted">
            KiCad footprint library:footprint format
          </small>
        </div>

        <div class="mb-3">
          <label class="form-label">Diode Footprint (Optional)</label>
          <input
            v-model="options.diodeFootprint"
            type="text"
            class="form-control"
            placeholder="e.g., Diode_SMD:D_SOD-123"
          />
        </div>
      </div>
    </div>

    <!-- Generate Button -->
    <div class="d-grid">
      <button
        class="btn btn-primary"
        @click="generateSchematic"
        :disabled="!canGenerate"
      >
        <span v-if="!isProcessing">
          <i class="bi bi-diagram-3"></i> Generate Schematic
        </span>
        <span v-else>
          <span class="spinner-border spinner-border-sm me-2"></span>
          Generating... {{ progress }}%
        </span>
      </button>
    </div>

    <!-- Progress Display -->
    <div v-if="isProcessing" class="mt-3">
      <div class="progress mb-2">
        <div
          class="progress-bar progress-bar-striped progress-bar-animated"
          :style="{ width: progress + '%' }"
        ></div>
      </div>
      <div class="small text-muted">{{ currentMessage }}</div>
    </div>

    <!-- Recent Jobs History -->
    <div v-if="recentJobs.length > 0" class="mt-4">
      <h6>Recent Generations</h6>
      <div class="list-group">
        <div
          v-for="job in recentJobs"
          :key="job.id"
          class="list-group-item d-flex justify-content-between align-items-center"
        >
          <div>
            <div class="small text-muted">{{ job.timestamp }}</div>
            <div class="badge" :class="getJobBadgeClass(job.status)">
              {{ job.status }}
            </div>
          </div>
          <button
            v-if="job.status === 'completed'"
            class="btn btn-sm btn-outline-primary"
            @click="downloadJob(job.id)"
          >
            <i class="bi bi-download"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="alert alert-danger mt-3">
      <i class="bi bi-exclamation-circle"></i>
      {{ error }}
    </div>

    <!-- Help Modal -->
    <SchematicHelpModal
      v-if="showHelp"
      @close="showHelp = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { useSchematicService } from '@/composables/useSchematicService'
import SchematicHelpModal from './SchematicHelpModal.vue'

const keyboardStore = useKeyboardStore()
const schematicService = useSchematicService()

// Component state
const options = ref({
  switchFootprint: '',
  diodeFootprint: ''
})

const isProcessing = ref(false)
const progress = ref(0)
const currentMessage = ref('')
const error = ref('')
const showHelp = ref(false)

// Service status
const {
  serviceStatus,
  isWakingService,
  checkHealth,
  wakeService
} = schematicService

// Check if layout has matrix annotations
const hasMatrixAnnotations = computed(() => {
  return keyboardStore.keys.some(key =>
    key.labels?.[4] && key.labels[4].includes(',')
  )
})

const canGenerate = computed(() =>
  hasMatrixAnnotations.value &&
  serviceStatus.value === 'online' &&
  !isProcessing.value
)

// Generate schematic
async function generateSchematic() {
  if (!canGenerate.value) return

  try {
    isProcessing.value = true
    error.value = ''
    progress.value = 0

    const result = await schematicService.generateSchematic(
      keyboardStore.getLayoutJson(),
      options.value,
      (progressData) => {
        progress.value = progressData.progress
        currentMessage.value = progressData.message
      }
    )

    if (result.success) {
      // Trigger download
      downloadSchematic(result.downloadUrl)
      toast.success('Schematic generated successfully!')
    } else {
      error.value = result.error || 'Generation failed'
    }
  } catch (err) {
    error.value = err.message || 'An unexpected error occurred'
  } finally {
    isProcessing.value = false
  }
}

// Lifecycle
onMounted(() => {
  checkHealth()
  // Poll health every 30s when service might be sleeping
  const interval = setInterval(checkHealth, 30000)
  onUnmounted(() => clearInterval(interval))
})
</script>
```

### 3.2 Schematic Service Composable

**File**: `src/composables/useSchematicService.ts`

```typescript
import { ref, computed } from 'vue'
import { toast } from './useToast'

const SERVICE_URL = import.meta.env.VITE_SCHEMATIC_SERVICE_URL || 'https://your-render-service.onrender.com'
const HEALTH_CHECK_TIMEOUT = 10000 // 10s
const WAKE_TIMEOUT = 60000 // 60s for cold start
const GENERATION_TIMEOUT = 300000 // 5min for processing

export type ServiceStatus = 'unknown' | 'online' | 'sleeping' | 'offline'
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed'

interface Job {
  id: string
  status: JobStatus
  progress: number
  message: string
  downloadUrl?: string
  error?: string
}

interface GenerateOptions {
  switchFootprint?: string
  diodeFootprint?: string
}

interface ProgressCallback {
  (data: { progress: number; message: string }): void
}

export function useSchematicService() {
  const serviceStatus = ref<ServiceStatus>('unknown')
  const isWakingService = ref(false)
  const currentJob = ref<Job | null>(null)

  let wsConnection: WebSocket | null = null

  /**
   * Check service health
   */
  async function checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT)

      const response = await fetch(`${SERVICE_URL}/api/health`, {
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        serviceStatus.value = 'online'
        return true
      } else {
        serviceStatus.value = 'offline'
        return false
      }
    } catch (error) {
      // Service likely sleeping or offline
      serviceStatus.value = 'sleeping'
      return false
    }
  }

  /**
   * Wake up sleeping service
   */
  async function wakeService(): Promise<boolean> {
    isWakingService.value = true
    toast.info('Waking up service... This may take up to 60 seconds.')

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), WAKE_TIMEOUT)

      const response = await fetch(`${SERVICE_URL}/api/health`, {
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        serviceStatus.value = 'online'
        toast.success('Service is now online!')
        return true
      }
      return false
    } catch (error) {
      toast.error('Failed to wake service. Please try again.')
      return false
    } finally {
      isWakingService.value = false
    }
  }

  /**
   * Generate schematic from layout
   */
  async function generateSchematic(
    layout: any,
    options: GenerateOptions,
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
    try {
      // 1. Submit job
      const submitResponse = await fetch(`${SERVICE_URL}/api/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          layout,
          options: {
            switch_footprint: options.switchFootprint || '',
            diode_footprint: options.diodeFootprint || ''
          }
        })
      })

      if (!submitResponse.ok) {
        const error = await submitResponse.json()
        throw new Error(error.message || 'Failed to submit job')
      }

      const jobData = await submitResponse.json()
      const jobId = jobData.job_id

      currentJob.value = {
        id: jobId,
        status: 'queued',
        progress: 0,
        message: 'Job queued...'
      }

      // 2. Connect WebSocket for progress (if available)
      if (jobData.websocket_url) {
        connectWebSocket(jobData.websocket_url, jobId, onProgress)
      }

      // 3. Poll for completion (fallback if WebSocket fails)
      const result = await pollJobStatus(jobId, onProgress)

      return result
    } catch (error) {
      console.error('Schematic generation error:', error)
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      }
    } finally {
      disconnectWebSocket()
    }
  }

  /**
   * Connect to WebSocket for real-time progress
   */
  function connectWebSocket(
    url: string,
    jobId: string,
    onProgress?: ProgressCallback
  ) {
    try {
      wsConnection = new WebSocket(url)

      wsConnection.onopen = () => {
        console.log('WebSocket connected')
        wsConnection?.send(JSON.stringify({
          type: 'subscribe_job',
          job_id: jobId
        }))
      }

      wsConnection.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (data.type === 'progress') {
          onProgress?.({
            progress: data.progress,
            message: data.message
          })
        }
      }

      wsConnection.onerror = (error) => {
        console.error('WebSocket error:', error)
        // Will fall back to polling
      }

      wsConnection.onclose = () => {
        console.log('WebSocket disconnected')
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
      // Will fall back to polling
    }
  }

  /**
   * Disconnect WebSocket
   */
  function disconnectWebSocket() {
    if (wsConnection) {
      wsConnection.close()
      wsConnection = null
    }
  }

  /**
   * Poll job status until completion
   */
  async function pollJobStatus(
    jobId: string,
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
    const pollInterval = 2000 // 2s
    const maxAttempts = GENERATION_TIMEOUT / pollInterval

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))

      try {
        const response = await fetch(`${SERVICE_URL}/api/jobs/${jobId}`)
        if (!response.ok) continue

        const job: Job = await response.json()

        // Update progress
        onProgress?.({
          progress: job.progress,
          message: job.message
        })

        if (job.status === 'completed') {
          return {
            success: true,
            downloadUrl: job.downloadUrl
          }
        }

        if (job.status === 'failed') {
          return {
            success: false,
            error: job.error || 'Processing failed'
          }
        }
      } catch (error) {
        console.error('Poll error:', error)
        // Continue polling
      }
    }

    return {
      success: false,
      error: 'Processing timeout'
    }
  }

  /**
   * Download schematic file
   */
  async function downloadSchematic(url: string) {
    try {
      const response = await fetch(`${SERVICE_URL}${url}`)
      const blob = await response.blob()

      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = 'matrix.kicad_sch'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download schematic')
    }
  }

  return {
    serviceStatus: computed(() => serviceStatus.value),
    isWakingService: computed(() => isWakingService.value),
    currentJob: computed(() => currentJob.value),
    checkHealth,
    wakeService,
    generateSchematic,
    downloadSchematic
  }
}
```

### 3.3 App.vue Integration

**Updates to `src/App.vue`**:

```typescript
// Add to imports
import SchematicGeneratorPanel from './components/SchematicGeneratorPanel.vue'

// Update sectionOrder to include 4 sections
const sectionOrder = ref(['canvas', 'properties', 'json', 'schematic'])

// Update collapsedSections
const collapsedSections = ref<Record<string, boolean>>({
  properties: false,
  canvas: false,
  json: false,
  schematic: false,
})

// Update sections computed
const sections = computed(() => ({
  canvas: {
    id: 'canvas',
    title: 'Layout Editor',
    component: 'CanvasSection',
  },
  properties: {
    id: 'properties',
    title: 'Key Properties',
    component: 'KeyPropertiesPanel',
  },
  json: {
    id: 'json',
    title: 'JSON Editor',
    component: 'JsonEditorPanel',
  },
  schematic: {
    id: 'schematic',
    title: 'Schematic Generator',
    component: 'SchematicGeneratorPanel',
  },
}))
```

Add template section:
```vue
<!-- Schematic Generator Section -->
<div
  v-else-if="section.id === 'schematic' && !collapsedSections[section.id]"
  class="card-body"
>
  <SchematicGeneratorPanel />
</div>
```

### 3.4 Environment Configuration

**File**: `.env.development`
```
VITE_SCHEMATIC_SERVICE_URL=http://localhost:5000
```

**File**: `.env.production`
```
VITE_SCHEMATIC_SERVICE_URL=https://your-service.onrender.com
```

---

## 4. Backend Service Updates

### 4.1 Required Dependencies

Add to service requirements:
```python
flask-socketio==5.4.1
python-socketio==5.12.0
redis==5.2.0  # Optional: for production queue
```

### 4.2 Enhanced Service Structure

**File**: `service/app.py`

```python
import os
import uuid
import tempfile
from datetime import datetime
from pathlib import Path
from queue import Queue
from threading import Thread
from flask import Flask, jsonify, request, send_file
from flask_socketio import SocketIO, emit, join_room
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Job management
job_queue = Queue()
jobs = {}  # job_id -> job data

# Worker thread
def worker():
    while True:
        job = job_queue.get()
        process_job(job)
        job_queue.task_done()

# Start workers
for i in range(2):
    t = Thread(target=worker, daemon=True)
    t.start()

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "version": "1.0.0",
        "queue_size": job_queue.qsize(),
        "active_jobs": len([j for j in jobs.values() if j['status'] == 'processing'])
    })

@app.route("/api/process", methods=["POST"])
def process():
    data = request.get_json()

    if not data or 'layout' not in data:
        return jsonify({"error": "No layout provided"}), 400

    # Validate matrix annotations
    layout = data['layout']
    if not has_matrix_annotations(layout):
        return jsonify({
            "error": "Layout must have matrix annotations (VIA format)"
        }), 400

    # Create job
    job_id = str(uuid.uuid4())
    job = {
        'id': job_id,
        'status': 'queued',
        'progress': 0,
        'message': 'Queued for processing',
        'layout': layout,
        'options': data.get('options', {}),
        'created_at': datetime.now().isoformat(),
        'output_file': None,
        'error': None
    }

    jobs[job_id] = job
    job_queue.put(job)

    return jsonify({
        'job_id': job_id,
        'status': 'queued',
        'websocket_url': f"ws://{request.host}/socket.io/"
    })

@app.route("/api/jobs/<job_id>", methods=["GET"])
def get_job(job_id):
    job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404

    response = {
        'job_id': job['id'],
        'status': job['status'],
        'progress': job['progress'],
        'message': job['message']
    }

    if job['status'] == 'completed':
        response['download_url'] = f"/api/download/{job_id}"
    elif job['status'] == 'failed':
        response['error'] = job['error']

    return jsonify(response)

@app.route("/api/download/<job_id>", methods=["GET"])
def download(job_id):
    job = jobs.get(job_id)
    if not job or job['status'] != 'completed':
        return jsonify({"error": "Job not found or not completed"}), 404

    output_file = job['output_file']
    if not output_file or not Path(output_file).exists():
        return jsonify({"error": "Output file not found"}), 404

    return send_file(
        output_file,
        as_attachment=True,
        download_name='matrix.kicad_sch',
        mimetype='text/plain'
    )

def process_job(job):
    """Process a job with progress updates"""
    job_id = job['id']

    try:
        # Update status
        job['status'] = 'processing'
        job['progress'] = 10
        job['message'] = 'Parsing layout...'
        emit_progress(job_id)

        # Convert layout
        layout = job['layout']
        keyboard = get_keyboard(layout)
        keyboard = MatrixAnnotatedKeyboard.from_keyboard(keyboard)
        keyboard.collapse()

        job['progress'] = 30
        job['message'] = 'Validating matrix...'
        emit_progress(job_id)

        # Create schematic
        with tempfile.NamedTemporaryFile(
            mode='w',
            suffix='.kicad_sch',
            delete=False
        ) as fp:
            output_path = fp.name

            job['progress'] = 50
            job['message'] = 'Generating schematic...'
            emit_progress(job_id)

            create_schematic(
                keyboard,
                output_path,
                switch_footprint=job['options'].get('switch_footprint', ''),
                diode_footprint=job['options'].get('diode_footprint', '')
            )

            job['progress'] = 90
            job['message'] = 'Finalizing...'
            emit_progress(job_id)

            job['output_file'] = output_path

        # Complete
        job['status'] = 'completed'
        job['progress'] = 100
        job['message'] = 'Complete!'
        emit_progress(job_id)

    except Exception as e:
        job['status'] = 'failed'
        job['error'] = str(e)
        job['message'] = f'Failed: {str(e)}'
        emit_progress(job_id)

def emit_progress(job_id):
    """Emit progress update via WebSocket"""
    job = jobs.get(job_id)
    if not job:
        return

    socketio.emit('progress', {
        'type': 'progress',
        'job_id': job_id,
        'progress': job['progress'],
        'message': job['message'],
        'status': job['status']
    }, room=job_id)

@socketio.on('subscribe_job')
def handle_subscribe(data):
    job_id = data.get('job_id')
    if job_id:
        join_room(job_id)
        emit('subscribed', {'job_id': job_id})

def has_matrix_annotations(layout):
    """Check if layout has matrix annotations"""
    # Implementation depends on layout format
    # Check for labels[4] containing "row,col" format
    pass

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=True)
```

### 4.3 Docker Configuration

**File**: `service/Dockerfile`

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 5000

# Run with gunicorn + eventlet for WebSocket support
CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "--bind", "0.0.0.0:5000", "app:app"]
```

**File**: `service/requirements.txt`

```
flask==3.1.0
flask-socketio==5.4.1
flask-cors==5.0.0
python-socketio==5.12.0
gunicorn==23.0.0
eventlet==0.37.0
kbplacer>=0.1.0  # Your library
skip>=0.1.0  # Your library
```

---

## 5. Communication Protocol

### 5.1 WebSocket vs Polling Trade-offs

| Aspect | WebSocket | Polling |
|--------|-----------|---------|
| Real-time | Excellent | Good (2s delay) |
| Server load | Low | Medium |
| Complexity | Higher | Lower |
| Reliability | Can fail | More robust |
| Fallback | Needs polling | N/A |

**Recommendation**: Use WebSocket with polling fallback

### 5.2 Message Formats

#### Progress Update (WebSocket)
```json
{
  "type": "progress",
  "job_id": "abc-123",
  "progress": 45,
  "message": "Processing key 15/42...",
  "status": "processing"
}
```

#### Job Status (HTTP)
```json
{
  "job_id": "abc-123",
  "status": "completed",
  "progress": 100,
  "message": "Complete!",
  "download_url": "/api/download/abc-123"
}
```

#### Error Response
```json
{
  "error": "Matrix annotations missing",
  "code": "INVALID_LAYOUT",
  "details": {
    "required": "VIA format with matrix annotations"
  }
}
```

---

## 6. Implementation Phases

### Phase 1: Basic Integration (Week 1)
- [ ] Create `SchematicGeneratorPanel.vue` component (basic UI)
- [ ] Implement `useSchematicService` composable (HTTP only, no WebSocket)
- [ ] Add health check endpoint to service
- [ ] Add process endpoint (simple, no queue)
- [ ] Integrate 4th section into `App.vue`
- [ ] Basic error handling and validation
- [ ] Manual testing with local service

**Deliverable**: Basic schematic generation working with polling

### Phase 2: Enhanced UX (Week 2)
- [ ] Add WebSocket support to service
- [ ] Implement WebSocket in `useSchematicService`
- [ ] Add progress bar and status messages
- [ ] Implement server wake-up detection
- [ ] Add footprint configuration options
- [ ] Create help modal with documentation
- [ ] Improve error messages and recovery

**Deliverable**: Real-time progress tracking with better UX

### Phase 3: Production Readiness (Week 3)
- [ ] Implement job queue system
- [ ] Add job persistence (SQLite or Redis)
- [ ] Implement rate limiting
- [ ] Add comprehensive error handling
- [ ] Create unit tests for frontend components
- [ ] Create integration tests for API
- [ ] Performance optimization
- [ ] Security hardening

**Deliverable**: Production-ready service

### Phase 4: Advanced Features (Week 4)
- [ ] Job history with local storage
- [ ] Batch processing support
- [ ] Schematic preview (optional)
- [ ] Export configuration presets
- [ ] Analytics and usage tracking
- [ ] A/B testing for UX improvements

**Deliverable**: Feature-complete service

---

## 7. Testing Strategy

### 7.1 Frontend Unit Tests

**File**: `src/components/__tests__/SchematicGeneratorPanel.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SchematicGeneratorPanel from '../SchematicGeneratorPanel.vue'
import { useSchematicService } from '@/composables/useSchematicService'

vi.mock('@/composables/useSchematicService')

describe('SchematicGeneratorPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows warning when no matrix annotations', () => {
    // Test implementation
  })

  it('disables generate button when service offline', () => {
    // Test implementation
  })

  it('shows progress during generation', async () => {
    // Test implementation
  })

  it('handles generation errors gracefully', async () => {
    // Test implementation
  })
})
```

### 7.2 Integration Tests

**File**: `e2e/schematic-generation.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Schematic Generation', () => {
  test('full generation flow', async ({ page }) => {
    // 1. Load layout with matrix annotations
    // 2. Navigate to Schematic Generator section
    // 3. Configure options
    // 4. Click generate
    // 5. Wait for completion
    // 6. Verify download triggered
  })

  test('handles service wake-up', async ({ page }) => {
    // Test wake-up flow
  })

  test('validates missing matrix annotations', async ({ page }) => {
    // Test validation
  })
})
```

### 7.3 Service Tests

**File**: `service/tests/test_api.py`

```python
import pytest
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_check(client):
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.json['status'] == 'ok'

def test_process_valid_layout(client):
    # Test implementation
    pass

def test_process_invalid_layout(client):
    # Test implementation
    pass
```

---

## 8. Error Handling & Edge Cases

### 8.1 Frontend Error Scenarios

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| Service offline | Health check timeout | Show status + wake button |
| Service sleeping | Health check fails | Auto-wake attempt |
| Invalid layout | Validation error | Show detailed message |
| Network error | Fetch failure | Retry with exponential backoff |
| WebSocket failure | Connection error | Fall back to polling |
| Processing timeout | No updates for 5min | Show timeout message + retry |
| Download failure | Blob error | Retry download |

### 8.2 Backend Error Scenarios

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| Invalid JSON | Parse error | Return 400 with details |
| Missing annotations | Validation | Return 400 with requirements |
| Processing crash | Exception | Mark job failed, log error |
| Out of memory | System error | Queue retry, reduce concurrency |
| File cleanup failure | I/O error | Log warning, continue |

### 8.3 Edge Cases

1. **Large layouts (200+ keys)**
   - Solution: Implement pagination in progress updates
   - Add timeout warnings

2. **Concurrent requests**
   - Solution: Queue system with max 2 concurrent jobs
   - Return 429 if queue full

3. **Stale jobs**
   - Solution: Clean up jobs older than 1 hour
   - Implement job expiration

4. **Browser tab closed during processing**
   - Solution: Job continues server-side
   - Can reconnect with job ID

---

## 9. Security Considerations

### 9.1 Input Validation

```python
MAX_LAYOUT_SIZE = 1_000_000  # 1MB
MAX_KEYS = 500

def validate_layout(layout):
    # Size check
    if len(str(layout)) > MAX_LAYOUT_SIZE:
        raise ValueError("Layout too large")

    # Key count check
    if len(layout.get('keys', [])) > MAX_KEYS:
        raise ValueError("Too many keys")

    # Sanitize strings
    # Check for malicious content
```

### 9.2 Rate Limiting

```python
from flask_limiter import Limiter

limiter = Limiter(
    app,
    key_func=lambda: request.remote_addr,
    default_limits=["100 per hour"]
)

@app.route("/api/process", methods=["POST"])
@limiter.limit("10 per hour")
def process():
    # Implementation
```

### 9.3 CORS Configuration

```python
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "https://yourdomain.com",
            "http://localhost:5173"  # Dev only
        ],
        "methods": ["GET", "POST"],
        "allow_headers": ["Content-Type"]
    }
})
```

### 9.4 File Security

- Store generated files in temp directory
- Use UUIDs for filenames (prevent path traversal)
- Implement file cleanup after download
- Set size limits on generated files

---

## 10. Deployment

### 10.1 Render.com Configuration

**File**: `render.yaml`

```yaml
services:
  - type: web
    name: kle-schematic-service
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:$PORT app:app
    envVars:
      - key: PYTHON_VERSION
        value: 3.10.0
      - key: PORT
        value: 5000
    healthCheckPath: /api/health
    autoDeploy: true
```

### 10.2 Environment Variables

**Production**:
```
PORT=5000
FLASK_ENV=production
MAX_WORKERS=2
JOB_TIMEOUT=300
CORS_ORIGINS=https://yourdomain.com
```

### 10.3 Frontend Deployment

Update `.env.production`:
```
VITE_SCHEMATIC_SERVICE_URL=https://kle-schematic-service.onrender.com
```

### 10.4 Monitoring

Set up health check monitoring:
- Render.com built-in health checks
- Optional: UptimeRobot for external monitoring
- Log aggregation (Render logs)

---

## 11. Future Enhancements

### 11.1 Short-term (Next Quarter)

1. **Schematic Validation**
   - Validate generated schematic with KiCad CLI
   - Show validation results to user

2. **Template Support**
   - Allow custom schematic templates
   - Preset configurations (MX switches, Choc switches, etc.)

3. **Batch Processing**
   - Process multiple layouts at once
   - Bulk download as ZIP

### 11.2 Long-term (Next Year)

1. **Advanced Features**
   - PCB layout generation (not just schematic)
   - BOM (Bill of Materials) generation
   - Manufacturing file export

2. **Collaboration**
   - Share generated schematics
   - Version control for designs

3. **Premium Features**
   - Priority queue for paid users
   - Advanced customization options
   - Technical support

---

## 12. Success Metrics

### 12.1 Key Performance Indicators

1. **Performance**
   - Service wake time: < 60s (p95)
   - Processing time: < 30s for 100-key layout (p50)
   - WebSocket connection success rate: > 95%

2. **Reliability**
   - Success rate: > 98%
   - Error rate: < 2%
   - Downtime: < 0.1%

3. **User Experience**
   - Time to first schematic: < 2min (including wake)
   - User satisfaction: > 4.5/5

### 12.2 Monitoring Dashboard

Track:
- Total generations
- Success/failure rates
- Average processing time
- Service uptime
- Error types distribution

---

## 13. Documentation

### 13.1 User Documentation

Create help modal explaining:
- What are matrix annotations
- How to annotate layout for VIA
- Schematic generation process
- How to use footprint options
- Troubleshooting common issues

### 13.2 Developer Documentation

- API documentation (OpenAPI/Swagger)
- WebSocket protocol specification
- Service deployment guide
- Contributing guidelines

---

## 14. Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: Basic Integration | 1 week | Working schematic generation (polling) |
| Phase 2: Enhanced UX | 1 week | WebSocket support, better UI |
| Phase 3: Production Ready | 1 week | Queue system, tests, security |
| Phase 4: Advanced Features | 1 week | History, presets, analytics |

**Total: 4 weeks to full production deployment**

---

## 15. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Render free tier limits | High | Medium | Monitor usage, upgrade if needed |
| WebSocket reliability | Medium | Low | Polling fallback implemented |
| Processing timeouts | Medium | Medium | Queue system, timeout handling |
| Large layout crashes | Low | High | Input validation, size limits |
| Security vulnerabilities | Low | High | Regular audits, input sanitization |

---

## Conclusion

This plan provides a comprehensive roadmap for integrating the KiCad schematic generation service into kle-ng. The phased approach allows for incremental development and testing, while the fallback mechanisms ensure reliability even with the constraints of Render.com's free tier.

The key innovations in this plan:
1. **Hybrid communication**: WebSocket + polling fallback
2. **Wake-up detection**: Automatic handling of sleeping service
3. **Progressive enhancement**: Basic functionality first, advanced features later
4. **User-centric design**: Clear status, helpful errors, smooth experience

This integration will make kle-ng a comprehensive tool for keyboard designers, covering the full workflow from layout design to schematic generation.
