import { Brand } from '@/components/shared/brand'
import { Button } from '@/components/ui/button'

// A casca aparece em todas as telas, então o que só ela usa de shared conta como usado por duas
export function Shell() {
  return (
    <Button>
      <Brand />
    </Button>
  )
}
