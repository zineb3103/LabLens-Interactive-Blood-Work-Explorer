# LabLens — Interactive Blood-Work Explorer

<div align="center">

**A comprehensive web application for exploring, analyzing, and querying blood-work datasets with advanced filtering, statistical analysis, and AI-powered natural language assistance.**

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2+-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Academic-blue.svg)](LICENSE)



</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Data Schema](#data-schema)
- [Installation](#installation)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Security & Privacy](#security--privacy)
- [Testing](#testing)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

LabLens is an interactive web application designed to load, explore, and analyze blood-work datasets. It provides powerful tools for data subsetting, statistical analysis, visualization, and natural language querying through an LLM-powered assistant.

### Key Capabilities

- **Free Subsetting**: Multi-criteria filtering with visual filter builder
- **Cohort Views**: Save, load, and share custom data views
- **Statistics**: Comprehensive descriptive statistics and distributions
- **Panels & Repeats**: Analyze same-day panels and repeat testing patterns
- **LLM Assistant**: Natural language queries with auditable execution plans

---

## ✨ Features

### 1. Data Ingestion & Validation
- Strict schema validation for blood-work files
- Support for CSV format (synthetic data in development)
- Automatic date parsing (dd/mm/yyyy format)
- Mixed-type handling for qualitative and quantitative results

### 2. Interactive Subsetting
- Visual filter builder for intuitive query construction
- Multi-criteria filtering (numorden, sexo, edad, nombre, nombre2, Date)
- Raw SQL mode for advanced users
- Saved cohort views with shareable links

### 3. Statistical Analysis
- Descriptive statistics (counts, means, standard deviations, quantiles)
- Missing data analysis
- Distribution visualizations
- Time trend analysis
- Qualitative rate calculations

### 4. Panels & Repeats Analytics
- Panel size analysis per patient-day
- Unique tests per day tracking
- Repeat testing patterns across dates
- Co-ordered test pair identification
- Service-based heatmaps (nombre2)

### 5. LLM-Powered Assistant
- Natural language to query DSL translation
- Auditable query execution plans
- Safe, read-only sandbox environment
- Query explanation and result visualization
- Chart generation from query results

### 6. Data Export
- CSV export
- Excel (XLSX) export
- Filtered data export

---

## 🏗️ Architecture

### Technology Stack

#### Backend
- **Framework**: FastAPI
- **ORM**: SQLModel/SQLAlchemy
- **Database**: DuckDB (development) / PostgreSQL (production)
- **Data Processing**: Pandas, Polars, PyArrow
- **Storage**: Parquet caches for performance
- **Security**: Python-JOSE, Passlib, Bcrypt

#### Frontend
- **Framework**: Next.js 14+ with React 18
- **Styling**: Tailwind CSS
- **Visualization**: Plotly.js, ECharts
- **Data Grid**: Custom robust DataGrid component
- **Language**: TypeScript

#### LLM Integration
- Rule-guided natural language to DSL translation
- Query guardrails and validation
- JSON template-based query generation
- Unit tests for prompt engineering

### System Components

```
┌─────────────────┐
│   Frontend      │  Next.js + React + Tailwind
│   (Port 3000)   │
└────────┬────────┘
         │
         │ HTTP/REST
         │
┌────────▼────────┐
│   Backend API   │  FastAPI + SQLModel
│   (Port 8000)   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼──────┐
│ DuckDB│ │ Parquet │
│       │ │  Cache  │
└───────┘ └─────────┘
```

---

## 📊 Data Schema

### Result Table
The core data schema for blood-work results:

| Column    | Type      | Description                          |
|-----------|-----------|--------------------------------------|
| `numorden`| String    | Order number (unique identifier)     |
| `sexo`    | String    | Gender                                |
| `edad`    | Integer   | Age                                   |
| `nombre`  | String    | Test name                             |
| `textores`| Mixed     | Result value (numeric or qualitative) |
| `nombre2` | String    | Service/Department name               |
| `Date`    | Date      | Test date (dd/mm/yyyy format)        |

**Note**: One row = one lab result. `textores` can contain numeric values or qualitative tokens (e.g., "TRACE").

### Additional Schemas

- **Panel**: `{numorden, date, tests[], n_tests}`
- **View**: `{id, name, owner, filter_dsl, created}`
- **LLMRun**: `{ts, user, prompt, query_dsl, rowcount, explain}`

---

## 🚀 Installation

### Prerequisites

- Python 3.10 or higher
- Node.js 18+ and npm
- Docker (optional, for containerized deployment)
- Make (optional, for convenience commands)

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Create virtual environment**:
   ```bash
   python -m venv venv
   ```

3. **Activate virtual environment**:
   ```bash
   # Windows
   venv\Scripts\activate
   
   # Linux/Mac
   source venv/bin/activate
   ```

4. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

5. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

6. **Initialize database**:
   ```bash
   # Database will be created automatically on first run
   ```

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

### Docker Setup (Alternative)

1. **Build and start services**:
   ```bash
   docker-compose up --build
   ```

This will start:
- Backend API on `http://localhost:8000`
- Frontend on `http://localhost:3000`

---

## 💻 Usage

### Starting the Application

#### Option 1: Using Makefile
```bash
# Start both backend and frontend
make dev

# Start backend only
make backend

# Start frontend only
make frontend
```

#### Option 2: Manual Start

**Backend**:
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

**Frontend**:
```bash
cd frontend
npm run dev
```

### Using the Application

1. **Upload Data**: Navigate to the upload page and select your `synthetic_bloodwork.csv` file
2. **Explore Data**: Use the explorer page to view and filter your dataset
3. **Create Cohorts**: Build custom filters and save them as cohort views
4. **Analyze Statistics**: View descriptive statistics and visualizations
5. **Query with LLM**: Use natural language to query your dataset through the assistant

### API Endpoints

- `POST /api/ingest` - Upload and validate blood-work file
- `GET /api/subset` - Apply filters to dataset
- `GET /api/stats` - Get descriptive statistics
- `GET /api/panels` - Analyze panel data
- `GET /api/repeats` - Analyze repeat testing
- `GET /api/coorder` - Get co-ordered test pairs
- `POST /api/llm/query` - Natural language query
- `GET /api/views` - Manage cohort views

Full API documentation available at `http://localhost:8000/docs` when the backend is running.

---

## 🔒 Security & Privacy

### Development Mode
- Uses synthetic dataset (`synthetic_bloodwork.csv`)
- Synthetic `numorden`, dates, and values
- Same schema and realistic distributions as production data

### Production Mode
- **Role-Based Access Control (RBAC)**: User authentication and authorization
- **Encryption at Rest**: Data encryption for stored files
- **Read-Only Queries**: Application queries are read-only
- **Audit Logs**: Full logging of all operations
- **LLM Sandbox**: Safe execution environment with query explanation

### Security Features
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CORS configuration
- Rate limiting (planned)

---

## 🧪 Testing

### Running Tests

```bash
# Backend tests
cd backend
pytest

# With coverage
pytest --cov=app --cov-report=html

# Frontend tests
cd frontend
npm test
```

### Test Coverage

- **Query Correctness**: Unit tests for NL→DSL mapping and filter semantics
- **Performance**: p95 latency < 1s on typical cohorts; memory stability under 500k rows
- **Usability**: Steps to create and save cohort views; SUS score evaluation
- **Safety**: Authorization test coverage; LLM execution auditing

---

## 📈 Roadmap

### Phase 1: Core Infrastructure (Weeks 1-2)
- ✅ Data ingestion and validation
- ✅ Database indexing
- ✅ Subset builder with visual filters

### Phase 2: Analytics & Visualization (Weeks 3-4)
- ✅ Descriptive statistics
- ✅ Panels and repeats analysis
- ✅ Co-ordering analysis
- ✅ Chart visualizations

### Phase 3: LLM Integration (Week 5)
- ✅ Natural language to DSL translation
- ✅ Sandbox execution with explain
- ✅ Data export (CSV/XLSX)

### Phase 4: Collaboration & Security (Week 6)
- 🔄 Shareable cohort views
- 🔄 RBAC implementation
- 🔄 Polish and comprehensive testing

---

## 📁 Project Structure

```
lablens/
├── backend/
│   ├── app/
│   │   ├── api/              # API endpoints
│   │   ├── core/             # Configuration, security, logging
│   │   ├── db/               # Database models and repositories
│   │   ├── services/         # Business logic engines
│   │   ├── utils/            # Utility functions
│   │   └── main.py           # FastAPI application
│   ├── data/                 # Database and cache files
│   ├── requirements.txt     # Python dependencies
│   └── Dockerfile           # Backend container
│
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/           # Next.js pages
│   │   ├── lib/             # Utilities and API client
│   │   └── styles/          # CSS and Tailwind config
│   ├── package.json         # Node dependencies
│   └── Dockerfile          # Frontend container
│
├── docs/                    # Documentation
├── tests/                   # Test suites
├── scripts/                 # Utility scripts
├── docker-compose.yml      # Docker orchestration
├── Makefile                # Convenience commands
└── README.md               # This file
```

---

## 🤝 Contributing

This is an academic project for IDSCC 5 at ENSAO. For contributions:

1. Follow the existing code style (Black for Python, ESLint for TypeScript)
2. Write tests for new features
3. Update documentation as needed
4. Ensure all tests pass before submitting

---

## 📚 Documentation

Additional documentation available in the `docs/` directory:

- `api_reference.md` - Complete API documentation
- `architecture.md` - System architecture details
- `data_schema.md` - Data model specifications
- `llm_design.md` - LLM integration design
- `security_model.md` - Security and privacy model

---

## 📄 License

This project is developed as part of the IDSCC 5 course at the National School of Applied Sciences (ENSAO), Mohammed First University, Oujda, Morocco.

**Academic Use Only**

---

## 👥 Authors

- **Project Team** - LabLens Development
- **Supervisor**: Prof. Abdelmounaim Kerkri
- **Institution**: National School of Applied Sciences (ENSAO)
- **University**: Mohammed First University
- **Location**: Oujda, Morocco

---

## 🙏 Acknowledgments

- FastAPI community for the excellent framework
- Next.js team for the React framework
- DuckDB for high-performance analytics
- All open-source contributors whose libraries made this project possible

---

## 📞 Contact

For questions or support regarding this project, please contact the course instructor or refer to the project documentation.

---

<div align="center">

**Made with ❤️ for IDSCC 5 — Artificial Intelligence, ENSAO**

</div>

