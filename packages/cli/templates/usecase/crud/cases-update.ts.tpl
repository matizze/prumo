    it('edita um registro e rejeita um id que não existe', async () => {
      const updated = await subject.{{key.update}}.execute({ id: '{{singular.kebab}}-1', {{test.editName}}: {{test.editValue}} })
      expect(updated).toMatchObject({ id: '{{singular.kebab}}-1', {{test.editName}}: {{test.editValue}} })
      expect((await subject.{{key.get}}.execute({ id: '{{singular.kebab}}-1' })).{{test.editName}}).toBe({{test.editValue}})
      await expect(
        subject.{{key.update}}.execute({ id: '{{singular.kebab}}-missing', {{test.editName}}: {{test.editValue}} }),
      ).rejects.toMatchObject({ status: 404 })
    })

    it('edita só os campos enviados e mantém os outros', async () => {
      expect(await subject.{{key.update}}.execute({ id: '{{singular.kebab}}-1' })).toEqual(MOCK_{{plural.constant}}[0])
      const updated = await subject.{{key.update}}.execute({ id: '{{singular.kebab}}-1', {{test.editName}}: {{test.partialValue}} })
      expect(updated).toEqual({ ...MOCK_{{plural.constant}}[0], {{test.editName}}: {{test.partialValue}} })
    })

    it('ignora o campo indefinido: ele não muda', async () => {
      expect(await subject.{{key.update}}.execute({ id: '{{singular.kebab}}-1', {{test.editName}}: undefined })).toEqual(
        MOCK_{{plural.constant}}[0],
      )
    })
