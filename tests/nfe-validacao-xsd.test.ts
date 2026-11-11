import { test } from 'node:test'
import assert from 'node:assert/strict'
import {testarSchemaAutoContido, validarXmlNfeXsdHomologacao} from '../src/lib/nfe-validacao-xsd'

test('XSD real valida XML em teste mínimo',()=>{
 const xsd='<?xml version="1.0"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">'+
  '<xs:element name="nota"><xs:complexType><xs:sequence>'+
  '<xs:element name="numero" type="xs:integer"/>'+
  '</xs:sequence></xs:complexType></xs:element></xs:schema>'
 assert.equal(testarSchemaAutoContido('<nota><numero>55</numero></nota>',xsd),true)
 assert.throws(()=>testarSchemaAutoContido('<nota><numero>abc</numero></nota>',xsd))
})
test('pacote 010g rejeita NF-e sem campos obrigatórios',()=>{
 assert.throws(()=>validarXmlNfeXsdHomologacao(
  '<NFe xmlns="http://www.portalfiscal.inf.br/nfe"/>'
 ),/XSD|pacote/)
})
