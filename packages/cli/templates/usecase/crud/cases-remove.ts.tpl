    it('remove um registro e rejeita um id que não existe', async () => {
      await subject.{{key.remove}}.execute({ id: '{{singular.kebab}}-1' })
      expect((await subject.{{key.list}}.execute({})).total).toBe(MOCK_{{plural.constant}}.length - 1)
      await expect(subject.{{key.get}}.execute({ id: '{{singular.kebab}}-1' })).rejects.toMatchObject({
        status: 404,
      })
      await expect(subject.{{key.remove}}.execute({ id: '{{singular.kebab}}-1' })).rejects.toMatchObject({
        status: 404,
      })
    })
