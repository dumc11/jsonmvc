import Ajv from 'ajv'

function fieldErrorModel(id, ns, field, schema) {
  return {
    name: `/${id}/action/data/${ns}/${field}/error`,
    path: `/${id}/action/data/${ns}/${field}/error`,
    args: {
      data: `/${id}/action/data/${ns}/${field}/value`,
      submit: `/${id}/action/submit`
    },
    fn: ({ data, submit }) => {
      if (!data && !submit) {
        return
      }

      let ajv = new Ajv()
      let result = ajv.validate(schema, data)

      if (!result) {
        return ajv.errors
      } else {
        return
      }
    }
  }
}

export default fieldErrorModel