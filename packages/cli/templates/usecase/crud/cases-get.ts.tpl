    it('busca um registro', async () => {
      expect(await subject.{{key.get}}.execute({ id: '{{singular.kebab}}-1' })).toEqual(MOCK_{{plural.constant}}[0])
    })

    it('rejeita um id que não existe com 404', async () => {
      await expect(subject.{{key.get}}.execute({ id: '{{singular.kebab}}-missing' })).rejects.toMatchObject({ status: 404 })
    })
