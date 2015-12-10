'use strict'
const assert = require('assert')
const Bus = require('../../../index.js')

describe('Cloned radior', ()=>{
  let bus
  beforeEach(()=>{
    bus = new Bus
  })

  it('should have the same event', function () {
    const event = 'dance'
    const secondEvent = 'sing'
    bus.on(event, function firstListener() {})

    bus.on(event, {
      fn: function secondListener() {},
      before: 'firstListener'
    })

    bus.on(event, {
      fn: function thirdListener() {},
      first: true
    })

    bus.on(secondEvent, {
      fn: function forthListener() {},
      first: true
    })

    const cloned = bus.clone()
    const clonedEvents = cloned.getEvents()
    const originEvent = bus.getEvents()
    assert.equal( clonedEvents.length, originEvent.length )
    originEvent.forEach((name,i)=>{
      assert.equal(name, clonedEvents[i])
    })
  })



  it('should have the same listener', function () {
    const event = 'dance'
    bus.on(event, function firstListener() {})

    bus.on(event, {
      fn: function secondListener() {},
      before: 'firstListener'
    })

    bus.on(event, {
      fn: function thirdListener() {},
      first: true
    })

    const cloned = bus.clone()
    assert.equal(cloned.getListeners(event).length, 3)
    const first = cloned.getListeners(event).head
    const second = first.next
    const third = second.next
    assert.equal(first.value.name, 'thirdListener')
    assert.equal(second.value.name, 'secondListener')
    assert.equal(third.value.name, 'firstListener')
  })


  it('should have unique runtime', function (done) {
    const event = 'dance'
    bus.on(event, function firstListener() {
      assert.notEqual( this.get('age'), undefined)
      assert.equal( this.get('name'), undefined)
      this.set('name','Jim')
    })

    bus.on(event, {
      fn: function secondListener() {
        assert.equal( this.get('age'), undefined)
        this.set('age',23)
      },
      before: 'firstListener'
    })

    bus.on(event, {
      fn: function thirdListener() {
        assert.equal( this.get('name'), undefined)
        this.setGlobal('gender', 'male')
      },
      first: true
    })

    const cloned = bus.clone()

    bus.fire(event).then(function(){

      return cloned.fire(event).then(function(){done()})

    }).catch(done)

  })
})




