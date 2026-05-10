import { memo } from 'react'

interface ChatBubbleProps {
  message: string
}

const ChatBubble = memo(({ message }: ChatBubbleProps) => {
  return (
    <div className="chat-bubble">
      {message}
    </div>
  )
})

ChatBubble.displayName = 'ChatBubble'

export default ChatBubble
