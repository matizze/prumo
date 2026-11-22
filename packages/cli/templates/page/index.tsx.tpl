import { use{{page.pascal}}Model } from './model'
import { {{page.pascal}}View } from './view'

export default function {{page.pascal}}Page() {
  const model = use{{page.pascal}}Model()
  return <{{page.pascal}}View {...model} />
}
