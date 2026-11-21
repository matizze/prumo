import { Table } from '@/components/shared/table'
import { actions } from '@/components/shared/table-actions'

export function View() {
  return <Table data-actions={actions.length} />
}
