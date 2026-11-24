    it('lista as fixtures, com ids únicos', async () => {
      const { items, total } = await subject.{{key.list}}.execute({})
      expect(total).toBe(MOCK_{{plural.constant}}.length)
      expect(new Set(items.map((item) => item.id)).size).toBe(MOCK_{{plural.constant}}.length)
    })

    it('busca {{fields.searchPhrase}}, sem diferenciar maiúsculas e acentos', async () => {
      const { items } = await subject.{{key.list}}.execute({ search: {{test.searchTerm}} })
      expect(items.map((item) => item.{{test.searchField}})).toEqual([{{test.searchHit}}])
      expect((await subject.{{key.list}}.execute({ search: 'nada disso' })).total).toBe(0)
    })

    it('ordena e pagina, com o total de antes da página', async () => {
      const page = await subject.{{key.list}}.execute({
        sort: { key: '{{test.sortKey}}', direction: 'desc' },
        page: 1,
        page_size: 2,
      })
      expect(page.total).toBe(MOCK_{{plural.constant}}.length)
      expect(page.items.map((item) => item.{{test.sortKey}})).toEqual([
        {{test.sortFirst}},
        {{test.sortSecond}},
      ])
    })
