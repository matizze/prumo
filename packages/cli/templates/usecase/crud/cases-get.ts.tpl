    it('busca um registro', async () => {
      expect(await subject.{{key.get}}.execute({ id: '{{singular.kebab}}-1' })).toEqual(MOCK_{{plural.constant}}[0])
    })

    it('rejeita um id que não existe com {{singular.constant}}_NOT_FOUND', async () => {
      const error = await subject.{{key.get}}.execute({ id: '{{singular.kebab}}-missing' }).catch((caught: unknown) => caught)
      expect(error).toBeInstanceOf(UIError)
      expect(error).toMatchObject({ code: '{{singular.constant}}_NOT_FOUND' })
    })
