# Yojana Mitra

AI-powered chatbot for Indian government schemes and welfare programs.

## Overview

Yojana Mitra is an intelligent chatbot designed to help Indian citizens discover and understand various government schemes and welfare programs. The bot provides personalized assistance by answering queries about eligibility criteria, application processes, benefits, and other relevant information about government initiatives.

## Features

- **Scheme Discovery**: Find relevant government schemes based on user profile and requirements
- **Eligibility Check**: Determine eligibility for various welfare programs
- **Application Guidance**: Step-by-step assistance for scheme applications
- **Multi-language Support**: Communicate in multiple Indian languages
- **Real-time Information**: Access to updated scheme details and guidelines
- **User-friendly Interface**: Simple and intuitive chat interface

## Technology Stack

- **Backend**: Python/Node.js (specify your actual tech stack)
- **AI/ML**: Natural Language Processing for query understanding
- **Database**: Store scheme information and user interactions
- **Frontend**: Web-based chat interface
- **APIs**: Integration with government data sources

## Installation

### Prerequisites

- Python 3.8+ or Node.js 14+
- Database (MySQL/PostgreSQL/MongoDB)
- API keys for AI services

### Setup

1. Clone the repository:
```bash
git clone https://github.com/kanishkez/yojana-mitra.git
cd yojana-mitra
```

2. Install dependencies:
```bash
# For Python
pip install -r requirements.txt

# For Node.js
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys and database credentials
```

4. Set up the database:
```bash
# Run database migrations
python manage.py migrate
# or
npm run migrate
```

5. Start the application:
```bash
# For Python
python app.py

# For Node.js
npm start
```

## Usage

### Basic Chat Interaction

1. Start a conversation with the bot
2. Ask questions about government schemes in natural language
3. Provide your basic information when prompted for personalized recommendations
4. Follow the guidance provided for scheme applications

### Example Queries

- "What schemes are available for farmers?"
- "Am I eligible for PM-KISAN scheme?"
- "How do I apply for Ayushman Bharat?"
- "Show me education schemes for girls"

## API Documentation

### Chat Endpoint

```http
POST /api/chat
Content-Type: application/json

{
  "message": "What are the schemes for small businesses?",
  "user_id": "unique_user_id",
  "session_id": "session_id"
}
```

### Response Format

```json
{
  "response": "Here are the schemes available for small businesses...",
  "schemes": [
    {
      "name": "MUDRA Yojana",
      "description": "Micro Units Development & Refinance Agency",
      "eligibility": "Small business owners",
      "benefits": "Loans up to ₹10 lakhs"
    }
  ],
  "follow_up_questions": [
    "Would you like to know more about MUDRA loan eligibility?",
    "Do you want information about other business schemes?"
  ]
}
```

## Data Sources

- myScheme.gov.in - Official government schemes portal
- Various ministry websites and official documentation
- Regularly updated scheme databases

## Configuration

### Environment Variables

```env
# AI Service Configuration
OPENAI_API_KEY=your_openai_key
HUGGING_FACE_KEY=your_hf_key

# Database Configuration
DATABASE_URL=your_database_url
DB_HOST=localhost
DB_PORT=5432
DB_NAME=yojana_mitra
DB_USER=username
DB_PASSWORD=password

# Application Settings
PORT=3000
DEBUG_MODE=false
LOG_LEVEL=info
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Create a Pull Request

### Guidelines

- Follow existing code style and conventions
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

## Testing

Run the test suite:

```bash
# Python
python -m pytest

# Node.js
npm test
```

## Deployment

### Using Docker

```bash
docker build -t yojana-mitra .
docker run -p 3000:3000 --env-file .env yojana-mitra
```

### Environment Setup

- Production deployment requires proper SSL certificates
- Configure rate limiting for API endpoints
- Set up monitoring and logging
- Ensure database backups are configured




---

**Disclaimer**: This chatbot provides general information about government schemes. For official and updated information, please refer to the respective government department websites.
