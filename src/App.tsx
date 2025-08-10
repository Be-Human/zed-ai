import React, { useState, useRef, useEffect } from 'react'

type Provider = 'openai' // | 'deepseek' // 注释掉 deepseek

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface Config {
  openai: {
    apiKey: string
    baseUrl: string
  }
  // deepseek: {
  //   apiKey: string
  //   baseUrl: string
  // }
}

// GraphQL 查询和变异定义
const CHAT_COMPLETION_MUTATION = `
  mutation ChatCompletion($input: ChatCompletionInput!) {
    chatCompletion(input: $input) {
      id
      object
      created
      model
      choices {
        index
        message {
          role
          content
        }
        finishReason
      }
      usage {
        promptTokens
        completionTokens
        totalTokens
      }
    }
  }
`

interface ChatCompletionInput {
  model: string
  messages: Array<{
    role: string
    content: string
  }>
  temperature?: number
  maxTokens?: number
}

interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{
    message: string
    path?: string[]
  }>
}

interface ChatCompletionData {
  chatCompletion: {
    id: string
    choices: Array<{
      message: {
        role: string
        content: string
      }
    }>
  }
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [provider, setProvider] = useState<Provider>('openai')
  const [config] = useState<Config>({
    openai: {
      apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
      baseUrl: import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1'
    }
    // deepseek: {
    //   apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY || '',
    //   baseUrl: import.meta.env.VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'
    // }
  })
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // GraphQL 请求函数
  const makeGraphQLRequest = async (query: string, variables: any, endpoint: string, apiKey: string) => {
    const response = await fetch(`${endpoint}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        query,
        variables
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: GraphQLResponse<ChatCompletionData> = await response.json()
    
    if (result.errors && result.errors.length > 0) {
      throw new Error(`GraphQL error: ${result.errors.map(e => e.message).join(', ')}`)
    }

    return result.data
  }

  // 备用 REST API 调用（如果 GraphQL 不可用）
  const makeRESTRequest = async (messages: Message[], currentConfig: any, modelName: string) => {
    const response = await fetch(`${currentConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentConfig.apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: 0.7,
        max_tokens: 1000
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const currentConfig = config[provider]
    if (!currentConfig.apiKey) {
      alert(`请先配置 ${provider.toUpperCase()} API Key`)
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const allMessages = [...messages, userMessage]
      const modelName = provider === 'openai' ? 'gpt-3.5-turbo' : 'deepseek-chat'
      
      let data: any

      try {
        // 首先尝试 GraphQL 调用
        const variables: ChatCompletionInput = {
          model: modelName,
          messages: allMessages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          temperature: 0.7,
          maxTokens: 1000
        }

        const graphqlData = await makeGraphQLRequest(
          CHAT_COMPLETION_MUTATION,
          { input: variables },
          currentConfig.baseUrl,
          currentConfig.apiKey
        )

        data = {
          choices: graphqlData?.chatCompletion.choices || []
        }
      } catch (graphqlError) {
        console.warn('GraphQL 请求失败，回退到 REST API:', graphqlError)
        
        // 如果 GraphQL 失败，回退到 REST API
        data = await makeRESTRequest(allMessages, currentConfig, modelName)
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.choices[0]?.message?.content || '抱歉，我没有收到回复',
        timestamp: Date.now()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `抱歉，发生了错误：${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    // 自动调整高度
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
  }

  return (
    <div className="chat-container">
      {/* 头部 */}
      <div className="chat-header">
        <h1 className="chat-title">Zed-AI 对话助手 (GraphQL)</h1>
        <select 
          className="provider-select" 
          value={provider} 
          onChange={(e) => setProvider(e.target.value as Provider)}
        >
          <option value="openai">OpenAI</option>
          {/* <option value="deepseek">DeepSeek</option> */}
        </select>
      </div>

      {/* 消息区域 */}
      <div className="messages">
        {messages.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            color: '#666', 
            fontSize: '16px',
            marginTop: '20%'
          }}>
            👋 欢迎使用 Zed-AI！<br/>
            现在使用 GraphQL API 进行对话
          </div>
        )}
        
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="message-avatar">
              {message.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-content">
              {message.content}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="message assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="typing">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="chat-input">
        <div className="input-wrapper">
          <textarea
            ref={inputRef}
            className="input-field"
            value={input}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="输入你的消息... (Enter发送，Shift+Enter换行)"
            disabled={isLoading}
            rows={1}
          />
          <button
            className="send-button"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
